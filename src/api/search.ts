import * as azdev from 'azure-devops-node-api';
import { handleApiError } from '../errors/index.js';

export interface CodeSearchResult {
  repo: string;
  path: string;
  branch: string;
  matches: number;
  url: string;
}

export interface CommitSearchResult {
  hash: string;
  author: string;
  date: string;
  message: string;
  repo: string;
  url: string;
}

export interface RepoResult {
  name: string;
  defaultBranch: string;
  url: string;
  updatedAt: string;
}

export async function searchCode(
  connection: azdev.WebApi,
  project: string,
  query: string,
  options: { repo?: string; limit?: number }
): Promise<CodeSearchResult[]> {
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';
  const token = (connection as unknown as { authHandler?: { token?: string } }).authHandler?.token ?? '';
  const limit = options.limit ?? 25;

  // Search API uses a different base URL
  const org = orgUrl.replace('https://dev.azure.com/', '').replace(/\/$/, '');
  const searchUrl = `https://almsearch.dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/search/codesearchresults?api-version=7.1`;

  const body: Record<string, unknown> = {
    searchText: query,
    '$skip': 0,
    '$top': limit,
    filters: options.repo ? { Repository: [options.repo] } : undefined,
    '$orderBy': null,
    includeFacets: false,
  };

  try {
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 203) {
        handleApiError({ statusCode: 401 }, 'Search');
      }
      if (response.status === 404) {
        // Search extension may not be installed — return empty
        return [];
      }
      handleApiError({ statusCode: response.status }, 'Code search');
    }

    const data = await response.json() as {
      results?: Array<{
        repository?: { name?: string };
        path?: string;
        branch?: string;
        matches?: Record<string, unknown[]>;
      }>
    };

    return (data.results ?? []).map(r => ({
      repo: r.repository?.name ?? '',
      path: r.path ?? '',
      branch: r.branch ?? '',
      matches: Object.values(r.matches ?? {}).reduce((acc, arr) => acc + arr.length, 0),
      url: `${orgUrl}/${encodeURIComponent(project)}/_search?text=${encodeURIComponent(query)}&type=code`,
    }));
  } catch (err) {
    handleApiError(err, 'Code search');
  }
}

export async function searchCommits(
  connection: azdev.WebApi,
  project: string,
  query: string,
  options: { repo?: string; limit?: number }
): Promise<CommitSearchResult[]> {
  const gitApi = await connection.getGitApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';
  const limit = options.limit ?? 25;

  try {
    let repos: Array<{ id?: string; name?: string }> = [];
    if (options.repo) {
      repos = [{ name: options.repo }];
    } else {
      repos = (await gitApi.getRepositories(project)) ?? [];
    }

    const results: CommitSearchResult[] = [];

    for (const repo of repos.slice(0, 5)) {
      if (!repo.name) continue;
      // GitQueryCommitsCriteria has no comment filter — fetch recent and filter client-side
      const fetchTop = Math.min(limit * 5, 100);
      const allCommits = await gitApi.getCommits(
        repo.name,
        { $top: fetchTop },
        project,
        undefined,
        fetchTop
      );
      const queryLower = query.toLowerCase();
      const commits = query
        ? (allCommits ?? []).filter(c => (c.comment ?? '').toLowerCase().includes(queryLower))
        : (allCommits ?? []);

      for (const c of commits ?? []) {
        results.push({
          hash: (c.commitId ?? '').slice(0, 8),
          author: c.author?.name ?? '',
          date: String(c.author?.date ?? ''),
          message: (c.comment ?? '').split('\n')[0] ?? '',
          repo: repo.name,
          url: `${orgUrl}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo.name)}/commit/${c.commitId ?? ''}`,
        });
      }

      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  } catch (err) {
    handleApiError(err, 'Commit search');
  }
}

export async function searchRepos(
  connection: azdev.WebApi,
  project: string,
  query: string,
  options: { limit?: number }
): Promise<RepoResult[]> {
  const gitApi = await connection.getGitApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  try {
    const repos = await gitApi.getRepositories(project);
    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 30;

    return (repos ?? [])
      .filter(r => !query || (r.name ?? '').toLowerCase().includes(queryLower))
      .slice(0, limit)
      .map(r => ({
        name: r.name ?? '',
        defaultBranch: (r.defaultBranch ?? '').replace('refs/heads/', ''),
        url: r.remoteUrl ?? `${orgUrl}/${encodeURIComponent(project)}/_git/${encodeURIComponent(r.name ?? '')}`,
        updatedAt: '',
      }));
  } catch (err) {
    handleApiError(err, 'Repository search');
  }
}

export async function searchWorkItems(
  connection: azdev.WebApi,
  project: string,
  query: string,
  options: { state?: string; limit?: number }
): Promise<Array<{ id: number; type: string; title: string; state: string; assignee: string; updatedAt: string; url: string }>> {
  const witApi = await connection.getWorkItemTrackingApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';
  const limit = options.limit ?? 25;

  const conditions = [
    `[System.TeamProject] = '${project.replace(/'/g, "''")}'`,
    `([System.Title] CONTAINS '${query.replace(/'/g, "''")}' OR [System.Description] CONTAINS '${query.replace(/'/g, "''")}')`,
  ];

  const state = options.state ?? 'open';
  if (state === 'open') {
    conditions.push(`[System.State] <> 'Closed'`);
    conditions.push(`[System.State] <> 'Resolved'`);
  } else if (state === 'closed') {
    conditions.push(`([System.State] = 'Closed' OR [System.State] = 'Resolved')`);
  }

  try {
    const result = await witApi.queryByWiql(
      { query: `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(' AND ')} ORDER BY [System.ChangedDate] DESC` },
      { project },
      undefined,
      limit
    );

    const ids = (result.workItems ?? []).slice(0, limit).map(wi => wi.id!).filter(Boolean);
    if (ids.length === 0) return [];

    const items = await witApi.getWorkItemsBatch({
      ids,
      fields: ['System.Id', 'System.WorkItemType', 'System.Title', 'System.State', 'System.AssignedTo', 'System.ChangedDate'],
    });

    return (items ?? []).map(wi => {
      const f = wi.fields ?? {};
      return {
        id: wi.id ?? 0,
        type: String(f['System.WorkItemType'] ?? ''),
        title: String(f['System.Title'] ?? ''),
        state: String(f['System.State'] ?? ''),
        assignee: String((f['System.AssignedTo'] as { displayName?: string } | undefined)?.displayName ?? f['System.AssignedTo'] ?? ''),
        updatedAt: String(f['System.ChangedDate'] ?? ''),
        url: `${orgUrl}/${encodeURIComponent(project)}/_workitems/edit/${wi.id ?? 0}`,
      };
    });
  } catch (err) {
    handleApiError(err, 'Work item search');
  }
}

export async function searchPrs(
  connection: azdev.WebApi,
  project: string,
  query: string,
  options: { state?: string; limit?: number }
): Promise<Array<{ id: number; title: string; author: string; status: string; repo: string; updatedAt: string; url: string }>> {
  const gitApi = await connection.getGitApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';
  const { PullRequestStatus } = await import('azure-devops-node-api/interfaces/GitInterfaces.js');

  let statusFilter = PullRequestStatus.All;
  if (options.state === 'open') statusFilter = PullRequestStatus.Active;
  else if (options.state === 'closed') statusFilter = PullRequestStatus.Abandoned;
  else if (options.state === 'merged') statusFilter = PullRequestStatus.Completed;

  const limit = options.limit ?? 25;

  try {
    const prs = await gitApi.getPullRequestsByProject(project, { status: statusFilter }, undefined, undefined, 200);
    const queryLower = query.toLowerCase();

    return (prs ?? [])
      .filter(pr => !query || (pr.title ?? '').toLowerCase().includes(queryLower))
      .slice(0, limit)
      .map(pr => ({
        id: pr.pullRequestId ?? 0,
        title: pr.title ?? '',
        author: pr.createdBy?.displayName ?? '',
        status: pr.status === 1 ? 'Active' : pr.status === 3 ? 'Completed' : 'Abandoned',
        repo: pr.repository?.name ?? '',
        updatedAt: String(pr.creationDate ?? ''),
        url: `${orgUrl}/${encodeURIComponent(project)}/_git/${encodeURIComponent(pr.repository?.name ?? '')}/pullrequest/${pr.pullRequestId ?? 0}`,
      }));
  } catch (err) {
    handleApiError(err, 'PR search');
  }
}
