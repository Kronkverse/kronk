import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { showAlert } from 'mastodon/actions/alerts';
import { apiGetSentRoses, apiSendRose } from 'mastodon/api/rose';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { MatePicker } from 'mastodon/features/nudges_messenger/mate_picker';
import { useAppDispatch } from 'mastodon/store';

// Send a rose without leaving /hub/rose (Tal 2026-10-11, Kommons proposal
// "Send a rose via the Rose korner"). Opened from the Ж menu.
//
// It is the Mate picker Nudges uses for a new chat, with a different thing
// to do on a tap: the rose goes, the row says so, and the picker stays open
// for the next person. The rules are the profile button's and are the
// server's to enforce: Mates only, one each per day.

const messages = defineMessages({
  title: { id: 'rose.send.title', defaultMessage: 'Send a rose' },
  sent: { id: 'rose.send.sent_today', defaultMessage: 'Sent today' },
  done: {
    id: 'rose.send.done',
    defaultMessage: 'You sent {name} a rose.',
  },
});

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

export const RoseSendPicker: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  // Who already has a rose from you today.
  const [sentTo, setSentTo] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    apiGetSentRoses()
      .then((roses) => {
        if (!cancelled) setSentTo(new Set(roses.map((r) => r.to_account.id)));
        return undefined;
      })
      .catch(() => {
        // Rows stay offered; a second rose is answered 409 and settles then.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markSent = useCallback((accountId: string) => {
    setSentTo((prev) => new Set(prev).add(accountId));
  }, []);

  const handlePick = useCallback(
    async (account: ApiAccountJSON) => {
      try {
        await apiSendRose(account.id);
      } catch (error) {
        // 409: one already went today, so the row is right to say so.
        if (statusOf(error) !== 409) throw error;
        markSent(account.id);
        return;
      }

      markSent(account.id);
      dispatch(
        showAlert({
          message: messages.done,
          values: { name: account.display_name || account.username },
        }),
      );
    },
    [dispatch, markSent],
  );

  const doneLabel = useCallback(
    (account: ApiAccountJSON) =>
      sentTo.has(account.id) ? intl.formatMessage(messages.sent) : null,
    [intl, sentTo],
  );

  return (
    <MatePicker
      title={intl.formatMessage(messages.title)}
      onPick={handlePick}
      doneLabel={doneLabel}
      onClose={onClose}
    />
  );
};
