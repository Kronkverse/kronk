import { useEffect } from 'react';

import { useAppDispatch } from 'mastodon/store';
import { connectStream } from 'mastodon/stream';

// Subscribe to the account-wide nudges firehose: `nudges:account` →
// `timeline:nudges:account:<id>`. Every new event/message in ANY of the
// viewer's conversations fans here (see Nudges::StreamPublisher#fan_to_accounts),
// so the messenger can refresh its sidebar + unread live — even for a
// conversation it doesn't currently have open (the per-conversation stream
// can't reach a brand-new conversation nobody's subscribed to).
//
// `onActivity` fires on any created event/message; the caller refetches the
// conversation list, which reseeds the true unread from the server.
export const useNudgesAccountStream = (onActivity: () => void) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const thunk = connectStream('nudges:account', {}, () => ({
      onConnect: () => {
        /* noop */
      },
      onReceive: (data: { event: string; payload: unknown }) => {
        if (
          data.event === 'nudges.event.created' ||
          data.event === 'nudges.message.created'
        ) {
          onActivity();
        }
      },
      onDisconnect: () => {
        /* noop */
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    const disconnect = dispatch(thunk) as unknown;

    return () => {
      if (typeof disconnect === 'function') {
        (disconnect as () => void)();
      }
    };
    // onActivity is captured by closure and expected to be a stable callback
    // (useCallback) — deliberately excluded so the socket doesn't re-open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);
};
