import api, {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPost,
  apiRequestPut,
} from 'mastodon/api';
import { apiCreateAttachment } from 'mastodon/api/attachments';
import type {
  FtdAsset,
  FtdAudit,
  FtdCategory,
  FtdComment,
  FtdCover,
  FtdItem,
  FtdItemKind,
  FtdJoining,
  FtdProject,
  FtdProjectSummary,
  FtdUpdate,
} from 'mastodon/api_types/freethedream';

// FreeTheDream's mechanism. Backend: Api::V1::Freethedream::*
// (docs/spaces/freethedream.md, "The mechanism").

const base = 'v1/freethedream';

export interface FtdProjectParams {
  title?: string;
  description?: string;
  ends_on?: string | null;
  joining?: FtdJoining;
  cover_media_attachment_id?: string | null;
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

// You've looked at this project's or section's talk.
export const apiFtdSeen = (id: string) =>
  apiRequestPost(`${base}/projects/${id}/seen`);

// A new project or section can start with the sections inside it and the
// gear all of it needs.
export interface FtdStarter {
  sections?: string[];
  needs?: { title: string; quantity: number; unit: string }[];
}

export const apiFtdCreateProject = (
  project: FtdProjectParams,
  starter: FtdStarter = {},
) => apiRequestPost<FtdProject>(`${base}/projects`, { project, ...starter });

export const apiFtdUpdateProject = (id: string, project: FtdProjectParams) =>
  apiRequestPut<FtdProject>(`${base}/projects/${id}`, { project });

export const apiFtdRemoveProject = (id: string) =>
  apiRequestDelete(`${base}/projects/${id}`);

export type FtdProjectAction = 'join' | 'leave' | 'take_over';

export const apiFtdProjectAction = (id: string, action: FtdProjectAction) =>
  apiRequestPost<FtdProject>(`${base}/projects/${id}/${action}`);

// A cover photo goes up as ordinary media first; the project then points
// at it (cover_media_attachment_id).
export const apiFtdUploadCover = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  const response = await api().post<FtdCover>('/api/v2/media', form);
  return response.data;
};

export const apiFtdInvite = (id: string, accountIds: string[]) =>
  apiRequestPost<{ invited: number }>(`${base}/projects/${id}/invite`, {
    account_ids: accountIds,
  });

// Link a Kalendar event to a project: a korner attachment from the event,
// made by the event's owner (docs/korners/adding_a_korner.md, Korner
// attachments).
export const apiFtdLinkEvent = (projectId: string, eventId: string) =>
  apiCreateAttachment({
    source_slug: 'kalendar',
    source_id: eventId,
    target_slug: 'freethedream',
    target_id: projectId,
    kind: 'link',
  });

export const apiFtdRsvp = (
  eventId: string,
  status: 'going' | 'interested' | 'remove',
) => apiRequestPost(`v1/events/${eventId}/rsvp`, { status });

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

export const apiFtdActivity = (projectId: string) =>
  apiRequestGet<FtdUpdate[]>(`${base}/projects/${projectId}/activity`);

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
