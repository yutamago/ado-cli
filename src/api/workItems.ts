import * as azdev from 'azure-devops-node-api';
import { WorkItemExpand } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import { handleApiError } from '../errors/index.js';

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
  }
): Promise<WorkItemSummary[]> {
  const witApi = await connection.getWorkItemTrackingApi();

  const conditions: string[] = [`[System.TeamProject] = '${project.replace(/'/g, "''")}'`];

  const state = options.state ?? 'open';
  if (state === 'open') {
    conditions.push(`[System.State] <> 'Closed'`);
    conditions.push(`[System.State] <> 'Resolved'`);
  } else if (state === 'closed') {
    conditions.push(`([System.State] = 'Closed' OR [System.State] = 'Resolved')`);
  }
  // 'all' → no state filter

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
