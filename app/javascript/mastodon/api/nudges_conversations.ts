import api, {
  apiRequestDelete,
  apiRequestGet,
  apiRequestPost,
} from 'mastodon/api';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeConversationDetail,
  ApiNudgeMessageJSON,
} from 'mastodon/api_types/nudges_conversations';

export const apiListNudgeConversations = () =>
  apiRequestGet<ApiNudgeConversationJSON[]>('v1/nudges/conversations');

export const apiGetNudgeConversation = (id: string) =>
  apiRequestGet<ApiNudgeConversationDetail>(`v1/nudges/conversations/${id}`);

export const apiSendNudgeMessage = (
  conversationId: string,
  body: string,
  mediaAttachmentId?: string,
) =>
  apiRequestPost<ApiNudgeMessageJSON>(
    `v1/nudges/conversations/${conversationId}/messages`,
    { body, media_attachment_id: mediaAttachmentId },
  );

export const apiDeleteNudgeMessage = (
  conversationId: string,
  messageId: string,
) =>
  apiRequestDelete<ApiNudgeMessageJSON>(
    `v1/nudges/conversations/${conversationId}/messages/${messageId}`,
  );

export const apiLeaveNudgeConversation = (conversationId: string) =>
  apiRequestPost<Record<string, never>>(
    `v1/nudges/conversations/${conversationId}/leave`,
  );

// Upload a file to Mastodon's media endpoint. Returns the id we can
// then attach to a Nudge message. Uses the axios instance directly
// because FormData needs a multipart POST.
interface ApiUploadedMedia {
  id: string;
  type: string;
  url: string | null;
  preview_url: string | null;
}

export const apiUploadMedia = async (file: File): Promise<ApiUploadedMedia> => {
  const form = new FormData();
  form.append('file', file);
  const response = await api().post<ApiUploadedMedia>('/api/v2/media', form);
  return response.data;
};

export const apiMarkNudgeConversationRead = (
  conversationId: string,
  upToMessageId?: string,
) =>
  apiRequestPost<ApiNudgeConversationJSON>(
    `v1/nudges/conversations/${conversationId}/read`,
    upToMessageId ? { up_to_message_id: upToMessageId } : {},
  );

export const apiAddNudgeReaction = (
  conversationId: string,
  messageId: string,
  symbol: string,
) =>
  apiRequestPost<ApiNudgeMessageJSON>(
    `v1/nudges/conversations/${conversationId}/messages/${messageId}/reactions`,
    { symbol },
  );

export const apiRemoveNudgeReaction = (
  conversationId: string,
  messageId: string,
  symbol: string,
) =>
  apiRequestDelete<ApiNudgeMessageJSON>(
    `v1/nudges/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(symbol)}`,
  );
