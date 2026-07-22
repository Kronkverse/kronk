import { useEffect } from 'react';

import type {
  ApiNudgeMessageJSON,
  ApiNudgeEventJSON,
} from 'mastodon/api_types/nudges_conversations';
import { useAppDispatch } from 'mastodon/store';
import { connectStream } from 'mastodon/stream';


// Streaming event names emitted by `Nudges::StreamPublisher`. Kept in
// sync with `app/lib/nudges/stream_publisher.rb`.
type StreamEvent =
  | { event: 'nudges.message.created'; payload: string }
  | { event: 'nudges.message.updated'; payload: string }
  | { event: 'nudges.message.deleted'; payload: string }
  | { event: 'nudges.event.created'; payload: string }
  | { event: 'nudges.read'; payload: string }
  | { event: string; payload: unknown };

// Read-pointer payload matches the Rails publisher's serializer.
export interface NudgesReadPayload {
  conversation_id: string;
  reader_account_id: string;
  last_read_message_id: string | null;
}

export interface NudgesStreamHandlers {
  onMessageCreated?: (message: ApiNudgeMessageJSON) => void;
  onMessageUpdated?: (message: ApiNudgeMessageJSON) => void;
  onMessageDeleted?: (message: ApiNudgeMessageJSON) => void;
  onEventCreated?: (event: ApiNudgeEventJSON) => void;
  onRead?: (payload: NudgesReadPayload) => void;
}

// Subscribe to `nudges:conversation` (channel `nudges/conversation` in
// URL form). Handlers are called with parsed JSON. Returns nothing;
// the effect handles teardown on unmount / id change.
export const useNudgesConversationStream = (
  conversationId: string | undefined,
  handlers: NudgesStreamHandlers,
) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!conversationId) return undefined;

    const thunk = connectStream(
      'nudges:conversation',
      { id: conversationId },
      () => ({
        onConnect: () => {
          /* noop */
        },
        onReceive: (data: StreamEvent) => {
          // The streaming publisher wraps the domain JSON as a
          // string inside `payload` — parse it once here so
          // handlers get typed objects.
          let parsed: unknown = null;
          if (typeof data.payload === 'string') {
            try {
              parsed = JSON.parse(data.payload);
            } catch {
              return;
            }
          } else {
            parsed = data.payload;
          }

          switch (data.event) {
            case 'nudges.message.created':
              handlers.onMessageCreated?.(parsed as ApiNudgeMessageJSON);
              break;
            case 'nudges.message.updated':
              handlers.onMessageUpdated?.(parsed as ApiNudgeMessageJSON);
              break;
            case 'nudges.message.deleted':
              handlers.onMessageDeleted?.(parsed as ApiNudgeMessageJSON);
              break;
            case 'nudges.event.created':
              handlers.onEventCreated?.(parsed as ApiNudgeEventJSON);
              break;
            case 'nudges.read':
              handlers.onRead?.(parsed as NudgesReadPayload);
              break;
            default:
              break;
          }
        },
        onDisconnect: () => {
          /* noop */
        },
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    const disconnect = dispatch(thunk) as unknown;

    return () => {
      if (typeof disconnect === 'function') {
        (disconnect as () => void)();
      }
    };
    // handlers are captured by closure and expected to be stable
    // callbacks (useCallback) — we deliberately don't include them so
    // the subscription doesn't re-open on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, dispatch]);
};
