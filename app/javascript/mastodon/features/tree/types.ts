// See docs/tree-brief.md for the full model.

export type NodeKind = 'layer' | 'idea';
export type Readiness =
  | 'blocked'
  | 'provisional'
  | 'ready'
  | 'building'
  | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type DepKind = 'needs' | 'secures' | 'relates';

export const READINESS_ORDER: Readiness[] = [
  'ready',
  'building',
  'provisional',
  'blocked',
  'done',
];

export const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
export const READINESSES: Readiness[] = [
  'blocked',
  'provisional',
  'ready',
  'building',
  'done',
];

export interface TreeNode {
  id: string;
  parent_id: string | null;
  kind: NodeKind;
  name: string;
  description: string;
  status: Readiness | null;
  priority: Priority | null;
  framework: string | null;
  steps: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TreeDependency {
  id: string;
  from_node_id: string;
  to_node_id: string;
  kind: DepKind;
  created_at: string;
}

export interface TreeCommentAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export interface TreeComment {
  id: string;
  node_id: string;
  body: string;
  created_at: string;
  account: TreeCommentAccount;
}
