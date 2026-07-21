import { apiRequestDelete, apiRequestGet, apiRequestPost } from 'mastodon/api';
import type {
  ApiNudgeConversationJSON,
  ApiNudgeConversationDetail,
  ApiNudgeMessageJSON,
} from 'mastodon/api_types/nudges_conversations';

export const apiListNudgeConversations = () =>
  apiRequestGet<ApiNudgeConversationJSON[]>('v1/nudges/conversations');

export const apiGetNudgeConversation = (id: string) =>
  apiRequestGet<ApiNudgeConversationDetail>(`v1/nudges/conversations/${id}`);

export const apiSendNudgeMessage = (conversationId: string, body: string) =>
  apiRequestPost<ApiNudgeMessageJSON>(
    `v1/nudges/conversations/${conversationId}/messages`,
    { body },
  );

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
