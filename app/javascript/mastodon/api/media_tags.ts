import api from 'mastodon/api';
import type {
  ApiMediaAttachmentJSON,
  ApiMediaTagJSON,
} from 'mastodon/api_types/media_attachments';

export const apiGetMediaTags = (mediaId: string) =>
  api()
    .get<ApiMediaTagJSON[]>(`/api/v1/media/${mediaId}/tags`)
    .then((r) => r.data);

export const apiAddMediaTag = (
  mediaId: string,
  accountId: string,
  x: number,
  y: number,
) =>
  api()
    .post<ApiMediaTagJSON>(`/api/v1/media/${mediaId}/tags`, {
      account_id: accountId,
      x,
      y,
    })
    .then((r) => r.data);

export const apiRemoveMediaTag = (mediaId: string, accountId: string) =>
  api().delete(`/api/v1/media/${mediaId}/tags/${accountId}`);

export const apiGetTaggedMedia = (accountId: string, maxId?: string) =>
  api()
    .get<ApiMediaAttachmentJSON[]>(
      `/api/v1/accounts/${accountId}/tagged_media`,
      {
        params: maxId ? { max_id: maxId } : undefined,
      },
    )
    .then((r) => r.data);
