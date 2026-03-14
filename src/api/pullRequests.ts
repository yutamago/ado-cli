import * as azdev from 'azure-devops-node-api';
import {
  PullRequestStatus,
  GitPullRequestSearchCriteria,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import { handleApiError } from '../errors/index.js';
import { AzdError } from '../errors/index.js';

export interface PrSummary {
  id: number;
  title: string;
  author: string;
  status: string;
  sourceBranch: string;
  targetBranch: string;
  repo: string;
  updatedAt: string;
  url: string;
  isDraft: boolean;
}

export interface PrDetail extends PrSummary {
  description: string;
  createdAt: string;
  reviewers: Array<{ name: string; vote: string }>;
  labels: string[];
  mergeStatus: string;
  commentCount: number;
}

export interface PrThread {
  id: number;
  status: string;
  comments: Array<{ author: string; content: string; createdAt: string }>;
}

export interface ChangedFile {
  path: string;
  changeType: string;
}

function prStatusToString(status?: number): string {
  switch (status) {
    case PullRequestStatus.Active: return 'Active';
    case PullRequestStatus.Completed: return 'Completed';
    case PullRequestStatus.Abandoned: return 'Abandoned';
    default: return 'Unknown';
  }
}

function prVoteToString(vote?: number): string {
  switch (vote) {
    case 10: return 'Approved';
    case 5: return 'Approved with suggestions';
    case 0: return 'No vote';
    case -5: return 'Waiting for author';
    case -10: return 'Rejected';
    default: return 'No vote';
  }
}

function stateToStatus(state: string): PullRequestStatus {
  switch (state.toLowerCase()) {
    case 'open': return PullRequestStatus.Active;
    case 'closed': return PullRequestStatus.Abandoned;
    case 'merged': return PullRequestStatus.Completed;
    default: return PullRequestStatus.All;
  }
}

function buildPrUrl(orgUrl: string, project: string, repo: string, id: number): string {
  return `${orgUrl}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repo)}/pullrequest/${id}`;
}

function cleanBranch(ref: string): string {
  return ref.replace('refs/heads/', '');
}

export async function listPullRequests(
  connection: azdev.WebApi,
  project: string,
  options: {
    state?: string;
    repo?: string;
    author?: string;
    limit?: number;
  }
): Promise<PrSummary[]> {
  const gitApi = await connection.getGitApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  const searchCriteria: GitPullRequestSearchCriteria = {
    status: stateToStatus(options.state ?? 'open'),
  };

  if (options.author) {
    // Author filter is handled client-side (API doesn't support it directly without identity ID)
  }

  const limit = options.limit ?? 30;

  try {
    let prs;
    if (options.repo) {
      prs = await gitApi.getPullRequests(options.repo, searchCriteria, project, undefined, undefined, limit);
    } else {
      prs = await gitApi.getPullRequestsByProject(project, searchCriteria, undefined, undefined, limit);
    }

    let results = prs ?? [];

    if (options.author) {
      const authorLower = options.author.toLowerCase();
      results = results.filter(pr => {
        const name = (pr.createdBy?.displayName ?? '').toLowerCase();
        return name.includes(authorLower);
      });
    }

    return results.slice(0, limit).map(pr => ({
      id: pr.pullRequestId ?? 0,
      title: pr.title ?? '',
      author: pr.createdBy?.displayName ?? '',
      status: prStatusToString(pr.status),
      sourceBranch: cleanBranch(pr.sourceRefName ?? ''),
      targetBranch: cleanBranch(pr.targetRefName ?? ''),
      repo: pr.repository?.name ?? '',
      updatedAt: String(pr.creationDate ?? ''),
      url: buildPrUrl(orgUrl, project, pr.repository?.name ?? '', pr.pullRequestId ?? 0),
      isDraft: pr.isDraft ?? false,
    }));
  } catch (err) {
    handleApiError(err, 'Pull requests');
  }
}

export async function getPullRequest(
  connection: azdev.WebApi,
  project: string,
  repoName: string,
  prId: number,
  includeThreads = false
): Promise<{ pr: PrDetail; threads: PrThread[] }> {
  const gitApi = await connection.getGitApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  try {
    const pr = await gitApi.getPullRequest(repoName, prId, project);

    const detail: PrDetail = {
      id: pr.pullRequestId ?? prId,
      title: pr.title ?? '',
      author: pr.createdBy?.displayName ?? '',
      status: prStatusToString(pr.status),
      sourceBranch: cleanBranch(pr.sourceRefName ?? ''),
      targetBranch: cleanBranch(pr.targetRefName ?? ''),
      repo: pr.repository?.name ?? repoName,
      updatedAt: String(pr.creationDate ?? ''),
      createdAt: String(pr.creationDate ?? ''),
      description: pr.description ?? '',
      reviewers: (pr.reviewers ?? []).map(r => ({
        name: r.displayName ?? '',
        vote: prVoteToString(r.vote),
      })),
      labels: (pr.labels ?? []).map(l => l.name ?? '').filter(Boolean),
      mergeStatus: pr.mergeStatus?.toString() ?? '',
      commentCount: 0,
      isDraft: pr.isDraft ?? false,
      url: buildPrUrl(orgUrl, project, pr.repository?.name ?? repoName, pr.pullRequestId ?? prId),
    };

    let threads: PrThread[] = [];
    if (includeThreads) {
      const rawThreads = await gitApi.getThreads(repoName, prId, project);
      threads = (rawThreads ?? []).map(t => ({
        id: t.id ?? 0,
        status: String(t.status ?? ''),
        comments: (t.comments ?? []).map(c => ({
          author: c.author?.displayName ?? '',
          content: c.content ?? '',
          createdAt: String(c.publishedDate ?? ''),
        })),
      }));
      detail.commentCount = threads.reduce((acc, t) => acc + t.comments.length, 0);
    }

    return { pr: detail, threads };
  } catch (err) {
    handleApiError(err, `PR #${prId}`);
  }
}

export async function addPrComment(
  connection: azdev.WebApi,
  project: string,
  repoName: string,
  prId: number,
  body: string
): Promise<void> {
  const gitApi = await connection.getGitApi();

  try {
    await gitApi.createThread(
      {
        comments: [{ content: body, commentType: 1 }],
        status: 1, // Active
      },
      repoName,
      prId,
      project
    );
  } catch (err) {
    handleApiError(err, `PR #${prId}`);
  }
}

export async function getPrChangedFiles(
  connection: azdev.WebApi,
  project: string,
  repoName: string,
  prId: number
): Promise<ChangedFile[]> {
  const gitApi = await connection.getGitApi();

  try {
    // Get latest iteration
    const iterations = await gitApi.getPullRequestIterations(repoName, prId, project);
    if (!iterations || iterations.length === 0) return [];

    const latestIteration = iterations[iterations.length - 1];
    const iterationId = latestIteration.id ?? 1;

    const changes = await gitApi.getPullRequestIterationChanges(repoName, prId, iterationId, project);

    return (changes.changeEntries ?? []).map(c => ({
      path: c.item?.path ?? '',
      changeType: String(c.changeType ?? ''),
    }));
  } catch (err) {
    handleApiError(err, `PR #${prId}`);
  }
}

export async function getPrDiff(
  connection: azdev.WebApi,
  project: string,
  repoName: string,
  prId: number
): Promise<string> {
  const gitApi = await connection.getGitApi();

  try {
    const pr = await gitApi.getPullRequest(repoName, prId, project);
    const sourceCommit = pr.lastMergeSourceCommit?.commitId;
    const targetCommit = pr.lastMergeTargetCommit?.commitId;

    if (!sourceCommit || !targetCommit) {
      throw new AzdError('PR does not have committed changes yet.');
    }

    const diffs = await gitApi.getCommitDiffs(
      repoName,
      project,
      undefined,
      100,
      0,
      { baseVersion: targetCommit, baseVersionType: 2 },
      { targetVersion: sourceCommit, targetVersionType: 2 }
    );

    const lines: string[] = [];
    for (const change of diffs.changes ?? []) {
      const path = change.item?.path ?? '';
      lines.push(`diff --git a${path} b${path}`);
      lines.push(`--- a${path}`);
      lines.push(`+++ b${path}`);
    }

    return lines.join('\n');
  } catch (err) {
    handleApiError(err, `PR #${prId}`);
  }
}

export async function resolveRepo(
  connection: azdev.WebApi,
  project: string,
  repoOption?: string
): Promise<string> {
  if (repoOption) return repoOption;

  const gitApi = await connection.getGitApi();
  const repos = await gitApi.getRepositories(project);

  if (!repos || repos.length === 0) {
    throw new AzdError(`No repositories found in project '${project}'.`);
  }
  if (repos.length === 1) {
    return repos[0].name ?? '';
  }

  throw new AzdError(
    `Multiple repositories found. Specify one with --repo:\n` +
    repos.map(r => `  ${r.name}`).join('\n')
  );
}
