import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { showAlert } from 'mastodon/actions/alerts';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useAppDispatch } from 'mastodon/store';

import { toggleRemind } from '../remind';
import type { BoothLive } from '../types';

const messages = defineMessages({
  remind: { id: 'booth.live.remind', defaultMessage: 'Remind me' },
  reminded: { id: 'booth.live.reminded', defaultMessage: 'Reminder set' },
  remindedToast: {
    id: 'booth.live.reminded_toast',
    defaultMessage: 'You’ll get a nudge when it starts',
  },
});

// "Remind me" for a scheduled set someone else is playing.
export const RemindButton: React.FC<{
  live: BoothLive;
  onChange?: (live: BoothLive) => void;
}> = ({ live, onChange }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const handleClick = useCallback(() => {
    void toggleRemind(live)
      .then((updated) => {
        onChange?.(updated);
        if (updated.reminded) {
          dispatch(showAlert({ message: messages.remindedToast }));
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [live, onChange, dispatch]);

  if (live.is_owner || live.state !== 'scheduled') return null;

  return (
    <KornerPill
      label={intl.formatMessage(
        live.reminded ? messages.reminded : messages.remind,
      )}
      active={live.reminded}
      onClick={handleClick}
    />
  );
};
