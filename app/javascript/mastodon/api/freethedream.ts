import {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
} from 'mastodon/api';
import type {
  FtdAsset,
  FtdAudit,
  FtdCategory,
  FtdComment,
  FtdItem,
  FtdItemKind,
  FtdJoining,
  FtdProject,
  FtdProjectSummary,
} from 'mastodon/api_types/freethedream';

// FreeTheDream's mechanism. Backend: Api::V1::Freethedream::*
// (docs/spaces/freethedream.md, "The mechanism").

const base = 'v1/freethedream';

export interface FtdProjectParams {
  title?: string;
  description?: string;
  starts_on?: string | null;
  ends_on?: string | null;
  location?: string;
  joining?: FtdJoining;
  done?: boolean;
  parent_id?: string;
}

export interface FtdItemParams {
  project_id?: string;
  need_id?: string;
  kind?: FtdItemKind;
  title?: string;
  body?: string;
  category?: FtdCategory | null;
  quantity?: number;
  unit?: string;
  asset_id?: string | null;
}

export interface FtdAssetParams {
  category?: FtdCategory;
  title?: string;
  note?: string;
  quantity?: number;
}

export const apiFtdProjects = (scope: 'all' | 'mine') =>
  apiRequestGet<FtdProjectSummary[]>(`${base}/projects`, { scope });

export const apiFtdProject = (id: string) =>
  apiRequestGet<FtdProject>(`${base}/projects/${id}`);

export const apiFtdCreateProject = (project: FtdProjectParams) =>
  apiRequestPost<FtdProject>(`${base}/projects`, { project });

export const apiFtdUpdateProject = (id: string, project: FtdProjectParams) =>
  apiRequestPut<FtdProject>(`${base}/projects/${id}`, { project });

export const apiFtdRemoveProject = (id: string) =>
  apiRequestDelete(`${base}/projects/${id}`);

export type FtdProjectAction = 'join' | 'leave' | 'take_over';

export const apiFtdProjectAction = (id: string, action: FtdProjectAction) =>
  apiRequestPost<FtdProject>(`${base}/projects/${id}/${action}`);

export const apiFtdHandOverProject = (id: string, accountId: string) =>
  apiRequestPost<FtdProject>(`${base}/projects/${id}/hand_over`, {
    account_id: accountId,
  });

export const apiFtdAnswerRequest = (
  projectId: string,
  accountId: string,
  answer: 'accept' | 'decline',
) =>
  apiRequestPost<FtdProject>(
    `${base}/projects/${projectId}/requests/${accountId}/${answer}`,
  );

export const apiFtdAddDependency = (projectId: string, dependsOnId: string) =>
  apiRequestPost<FtdProject>(`${base}/projects/${projectId}/dependencies`, {
    depends_on_id: dependsOnId,
  });

export const apiFtdRemoveDependency = (
  projectId: string,
  dependsOnId: string,
) =>
  apiRequestDelete<FtdProject>(
    `${base}/projects/${projectId}/dependencies/${dependsOnId}`,
  );

export const apiFtdAudit = (projectId: string) =>
  apiRequestGet<FtdAudit>(`${base}/projects/${projectId}/audit`);

export const apiFtdItem = (id: string) =>
  apiRequestGet<FtdItem>(`${base}/items/${id}`);

export const apiFtdCreateItem = (item: FtdItemParams) =>
  apiRequestPost<FtdItem>(`${base}/items`, { item });

export const apiFtdUpdateItem = (id: string, item: FtdItemParams) =>
  apiRequestPut<FtdItem>(`${base}/items/${id}`, { item });

export const apiFtdRemoveItem = (id: string) =>
  apiRequestDelete(`${base}/items/${id}`);

export type FtdItemAction = 'claim' | 'unclaim' | 'take_over';

export const apiFtdItemAction = (id: string, action: FtdItemAction) =>
  apiRequestPost<FtdItem>(`${base}/items/${id}/${action}`);

// Set how much of a need you're bringing; 0 takes it back.
export const apiFtdBring = (id: string, quantity: number) =>
  apiRequestPost<FtdItem>(`${base}/items/${id}/bring`, { quantity });

export const apiFtdHandOverItem = (id: string, accountId: string) =>
  apiRequestPost<FtdItem>(`${base}/items/${id}/hand_over`, {
    account_id: accountId,
  });

export const apiFtdTakeOn = (id: string, as: 'part' | 'job') =>
  apiRequestPost<{ type: 'part' | 'job'; id: string }>(
    `${base}/items/${id}/take_on`,
    { as },
  );

export const apiFtdPlace = (itemId: string, projectId: string) =>
  apiRequestPost<FtdItem>(`${base}/items/${itemId}/placements`, {
    project_id: projectId,
  });

export const apiFtdUnplace = (itemId: string, projectId: string) =>
  apiRequestDelete<FtdItem>(`${base}/items/${itemId}/placements/${projectId}`);

export const apiFtdComment = (
  subjectType: 'project' | 'item',
  subjectId: string,
  body: string,
  parentId?: string,
) =>
  apiRequestPost<FtdComment[]>(`${base}/comments`, {
    subject_type: subjectType,
    subject_id: subjectId,
    body,
    parent_id: parentId,
  });

export const apiFtdRemoveComment = (id: string) =>
  apiRequestDelete<FtdComment[]>(`${base}/comments/${id}`);

export const apiFtdResolveThread = (id: string, resolved: boolean) =>
  apiRequestPost<FtdComment[]>(
    `${base}/comments/${id}/${resolved ? 'resolve' : 'unresolve'}`,
  );

export const apiFtdAssets = () => apiRequestGet<FtdAsset[]>(`${base}/assets`);

export const apiFtdCreateAsset = (asset: FtdAssetParams) =>
  apiRequestPost<FtdAsset>(`${base}/assets`, { asset });

export const apiFtdUpdateAsset = (id: string, asset: FtdAssetParams) =>
  apiRequestPut<FtdAsset>(`${base}/assets/${id}`, { asset });

export const apiFtdRemoveAsset = (id: string) =>
  apiRequestDelete(`${base}/assets/${id}`);

export const apiFtdShareAsset = (
  id: string,
  projectId: string,
  share: boolean,
) =>
  apiRequestPost<FtdAsset>(
    `${base}/assets/${id}/${share ? 'share' : 'unshare'}`,
    { project_id: projectId },
  );
