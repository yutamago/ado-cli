import * as azdev from 'azure-devops-node-api';
import { WorkItemExpand } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import { handleApiError } from '../errors/index.js';

export async function createWorkItem(
  connection: azdev.WebApi,
  project: string,
  type: string,
  fields: { title: string; description?: string; assignee?: string; tags?: string }
): Promise<WorkItemSummary> {
  const witApi = await connection.getWorkItemTrackingApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  const doc = [
    { op: 'add' as const, path: '/fields/System.Title', value: fields.title },
    ...(fields.description ? [{ op: 'add' as const, path: '/fields/System.Description', value: fields.description }] : []),
    ...(fields.assignee ? [{ op: 'add' as const, path: '/fields/System.AssignedTo', value: fields.assignee }] : []),
    ...(fields.tags ? [{ op: 'add' as const, path: '/fields/System.Tags', value: fields.tags }] : []),
  ];

  try {
    const wi = await witApi.createWorkItem({} as Record<string, string>, doc, project, type);
    const f = wi.fields ?? {};
    return {
      id: wi.id ?? 0,
      type: String(f['System.WorkItemType'] ?? type),
      title: String(f['System.Title'] ?? fields.title),
      state: String(f['System.State'] ?? ''),
      assignee: String((f['System.AssignedTo'] as { displayName?: string } | undefined)?.displayName ?? f['System.AssignedTo'] ?? ''),
      tags: String(f['System.Tags'] ?? ''),
      updatedAt: String(f['System.ChangedDate'] ?? ''),
      url: buildOrgUrl(orgUrl, project, wi.id ?? 0),
    };
  } catch (err) {
    handleApiError(err, 'Work item');
  }
}

export async function patchWorkItem(
  connection: azdev.WebApi,
  project: string,
  id: number,
  fields: Record<string, string>
): Promise<WorkItemSummary> {
  const witApi = await connection.getWorkItemTrackingApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  const doc = Object.entries(fields).map(([path, value]) => ({
    op: 'add' as const,
    path: `/fields/${path}`,
    value,
  }));

  try {
    const wi = await witApi.updateWorkItem({} as Record<string, string>, doc, id, project);
    const f = wi.fields ?? {};
    return {
      id: wi.id ?? id,
      type: String(f['System.WorkItemType'] ?? ''),
      title: String(f['System.Title'] ?? ''),
      state: String(f['System.State'] ?? ''),
      assignee: String((f['System.AssignedTo'] as { displayName?: string } | undefined)?.displayName ?? f['System.AssignedTo'] ?? ''),
      tags: String(f['System.Tags'] ?? ''),
      updatedAt: String(f['System.ChangedDate'] ?? ''),
      url: buildOrgUrl(orgUrl, project, wi.id ?? id),
    };
  } catch (err) {
    handleApiError(err, `Work item #${id}`);
  }
}

export async function addWorkItemComment(
  connection: azdev.WebApi,
  project: string,
  id: number,
  text: string
): Promise<void> {
  const witApi = await connection.getWorkItemTrackingApi();
  try {
    // Add comment via System.History field (discussion)
    await witApi.updateWorkItem(
      {} as Record<string, string>,
      [{ op: 'add' as const, path: '/fields/System.History', value: text }],
      id,
      project,
    );
  } catch (err) {
    handleApiError(err, `Work item #${id}`);
  }
}

export interface WorkItemSummary {
  id: number;
  type: string;
  title: string;
  state: string;
  assignee: string;
  tags: string;
  updatedAt: string;
  url: string;
}

export interface WorkItemDetail extends WorkItemSummary {
  description: string;
  createdAt: string;
  commentCount: number;
  priority: string;
  areaPath: string;
  iterationPath: string;
  acceptanceCriteria: string;
  raw: Record<string, unknown>;
}

export interface WorkItemComment {
  id: number;
  author: string;
  createdAt: string;
  text: string;
}

function buildOrgUrl(orgUrl: string, project: string, id: number): string {
  return `${orgUrl}/${encodeURIComponent(project)}/_workitems/edit/${id}`;
}

export async function listWorkItems(
  connection: azdev.WebApi,
  project: string,
  options: {
    state?: string;
    assignee?: string;
    tag?: string;
    limit?: number;
    type?: string;
    iterationPath?: string;
  }
): Promise<WorkItemSummary[]> {
  const witApi = await connection.getWorkItemTrackingApi();

  const conditions: string[] = [`[System.TeamProject] = '${project.replace(/'/g, "''")}'`];

  const orStates = options.state
    ?.split(/,|\||\|\|/)
    .map(s => s
      .split(/&|&&/)
      .map(t => t.trim())
      .map(s => ({
        not: s.startsWith('!'),
        state: s.replace(/^!/g, "").trim(),
      })));

  if (orStates && orStates.length > 0) {
    const statesCondition = orStates
      .map(andStates => andStates
        .map(s => `[System.State] ${s.not ? '<>' : '='} '${s.state.replace(/'/g, "''")}'`)
        .join(' AND ')
      ).join(' OR ');

    conditions.push(`(${statesCondition})`);
  }

  if (options.assignee) {
    if (options.assignee === '@me') {
      conditions.push(`[System.AssignedTo] = @Me`);
    } else {
      conditions.push(`[System.AssignedTo] CONTAINS '${options.assignee.replace(/'/g, "''")}'`);
    }
  }

  if (options.tag) {
    conditions.push(`[System.Tags] CONTAINS '${options.tag.replace(/'/g, "''")}'`);
  }

  if (options.type) {
    conditions.push(`[System.WorkItemType] = '${options.type.replace(/'/g, "''")}'`);
  }

  if (options.iterationPath) {
    conditions.push(`[System.IterationPath] CONTAINS '${options.iterationPath.replace(/'/g, "''")}'`);
  }

  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE ${conditions.join(' AND ')} ORDER BY [System.ChangedDate] DESC`,
  };

  const limit = options.limit ?? 30;

  try {
    const result = await witApi.queryByWiql(wiql, { project }, undefined, limit);
    const ids = (result.workItems ?? []).slice(0, limit).map(wi => wi.id!).filter(Boolean);

    if (ids.length === 0) return [];

    const items = await witApi.getWorkItemsBatch({
      ids,
      fields: [
        'System.Id', 'System.WorkItemType', 'System.Title', 'System.State',
        'System.AssignedTo', 'System.Tags', 'System.ChangedDate', 'System.TeamProject',
      ],
    });

    const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

    return (items ?? []).map(wi => {
      const f = wi.fields ?? {};
      return {
        id: wi.id ?? 0,
        type: String(f['System.WorkItemType'] ?? ''),
        title: String(f['System.Title'] ?? ''),
        state: String(f['System.State'] ?? ''),
        assignee: String((f['System.AssignedTo'] as { displayName?: string } | undefined)?.displayName ?? f['System.AssignedTo'] ?? ''),
        tags: String(f['System.Tags'] ?? ''),
        updatedAt: String(f['System.ChangedDate'] ?? ''),
        url: buildOrgUrl(orgUrl, project, wi.id ?? 0),
      };
    });
  } catch (err) {
    handleApiError(err, 'Work items');
  }
}

export async function getWorkItem(
  connection: azdev.WebApi,
  project: string,
  id: number,
  includeComments = false
): Promise<{ item: WorkItemDetail; comments: WorkItemComment[] }> {
  const witApi = await connection.getWorkItemTrackingApi();
  const orgUrl = (connection as unknown as { _serverUrl: string })._serverUrl ?? '';

  try {
    const wi = await witApi.getWorkItem(id, undefined, undefined, WorkItemExpand.All);
    const f = wi.fields ?? {};

    const item: WorkItemDetail = {
      id: wi.id ?? id,
      type: String(f['System.WorkItemType'] ?? ''),
      title: String(f['System.Title'] ?? ''),
      state: String(f['System.State'] ?? ''),
      assignee: String((f['System.AssignedTo'] as { displayName?: string } | undefined)?.displayName ?? f['System.AssignedTo'] ?? ''),
      tags: String(f['System.Tags'] ?? ''),
      updatedAt: String(f['System.ChangedDate'] ?? ''),
      createdAt: String(f['System.CreatedDate'] ?? ''),
      description: String(f['System.Description'] ?? f['Microsoft.VSTS.TCM.ReproSteps'] ?? ''),
      commentCount: Number(f['System.CommentCount'] ?? 0),
      priority: String(f['Microsoft.VSTS.Common.Priority'] ?? ''),
      areaPath: String(f['System.AreaPath'] ?? ''),
      iterationPath: String(f['System.IterationPath'] ?? ''),
      acceptanceCriteria: String(f['Microsoft.VSTS.Common.AcceptanceCriteria'] ?? ''),
      url: buildOrgUrl(orgUrl, project, wi.id ?? id),
      raw: f as Record<string, unknown>,
    };

    let comments: WorkItemComment[] = [];
    if (includeComments && item.commentCount > 0) {
      const commentsResult = await witApi.getComments(project, id);
      comments = (commentsResult.comments ?? []).map(c => ({
        id: c.id ?? 0,
        author: String((c.createdBy as { displayName?: string } | undefined)?.displayName ?? ''),
        createdAt: String(c.createdDate ?? ''),
        text: String(c.text ?? ''),
      }));
    }

    return { item, comments };
  } catch (err) {
    handleApiError(err, `Work item #${id}`);
  }
}
