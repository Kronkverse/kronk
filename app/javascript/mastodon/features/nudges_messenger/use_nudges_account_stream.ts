import { useEffect } from 'react';

import { useAppDispatch } from 'mastodon/store';
import { connectStream } from 'mastodon/stream';

// What arrived: something in a chat (a message, or a line that belongs to
// the chat such as a Krew join), or a notification addressed to the viewer.
export type NudgesArrival = 'chat' | 'notification';

const ARRIVALS: Record<string, NudgesArrival | undefined> = {
  'nudges.message.created': 'chat',
  'nudges.event.created': 'chat',
  'nudges.notification.created': 'notification',
};

// Subscribe to the account-wide nudges firehose: `nudges:account` →
// `timeline:nudges:account:<id>`. Every new message or chat line in ANY of
// the viewer's conversations fans here, and so does every notification
// addressed to them (see Nudges::StreamPublisher), so Nudges can refresh
// live — even for a conversation that isn't open.
//
// `onActivity` fires with what arrived; the caller refetches the matching
// list, which reseeds the true count from the server.
export const useNudgesAccountStream = (
  onActivity: (arrival: NudgesArrival) => void,
) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const thunk = connectStream('nudges:account', {}, () => ({
      onConnect: () => {
        /* noop */
      },
      onReceive: (data: { event: string; payload: unknown }) => {
        const arrival = ARRIVALS[data.event];
        if (arrival) onActivity(arrival);
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
