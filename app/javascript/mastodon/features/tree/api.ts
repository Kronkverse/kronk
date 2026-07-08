import api from 'mastodon/api';

import type {
  TreeNode,
  TreeDependency,
  TreeComment,
  NodeKind,
  Readiness,
  Priority,
  DepKind,
} from './types';

export interface NewNodePayload {
  parent_id: string | null;
  kind: NodeKind;
  name: string;
  description?: string;
  status?: Readiness | null;
  priority?: Priority | null;
  framework?: string | null;
}

export interface UpdateNodePayload {
  name?: string;
  description?: string;
  status?: Readiness | null;
  priority?: Priority | null;
  framework?: string | null;
}

export async function fetchNodes(): Promise<TreeNode[]> {
  const res = await api().get<TreeNode[]>('/api/v1/tree/nodes');
  return res.data;
}

export async function fetchDependencies(): Promise<TreeDependency[]> {
  const res = await api().get<TreeDependency[]>('/api/v1/tree/dependencies');
  return res.data;
}

export async function createNode(payload: NewNodePayload): Promise<TreeNode> {
  const res = await api().post<TreeNode>('/api/v1/tree/nodes', payload);
  return res.data;
}

export async function updateNode(
  id: string,
  payload: UpdateNodePayload,
): Promise<TreeNode> {
  const res = await api().patch<TreeNode>(`/api/v1/tree/nodes/${id}`, payload);
  return res.data;
}

export async function deleteNode(id: string): Promise<void> {
  await api().delete(`/api/v1/tree/nodes/${id}`);
}

export async function createDependency(
  fromId: string,
  toId: string,
  kind: DepKind,
): Promise<TreeDependency> {
  const res = await api().post<TreeDependency>('/api/v1/tree/dependencies', {
    from_node_id: fromId,
    to_node_id: toId,
    kind,
  });
  return res.data;
}

export async function deleteDependency(id: string): Promise<void> {
  await api().delete(`/api/v1/tree/dependencies/${id}`);
}

export async function fetchComments(nodeId: string): Promise<TreeComment[]> {
  const res = await api().get<TreeComment[]>(
    `/api/v1/tree/nodes/${nodeId}/comments`,
  );
  return res.data;
}

export async function createComment(
  nodeId: string,
  body: string,
): Promise<TreeComment> {
  const res = await api().post<TreeComment>(
    `/api/v1/tree/nodes/${nodeId}/comments`,
    { body },
  );
  return res.data;
}
