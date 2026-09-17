import { useEffect, useRef } from 'react';

import { defineMessages } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { showAlert } from 'mastodon/actions/alerts';
import { compareId } from 'mastodon/compare_id';
import { selectLatestAlertNotification } from 'mastodon/selectors/notifications';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// NudgeArrivalToast — shows a transient in-app toast (the shared alerts
// system) when a NEW nudge or korner/system notification lands, reacting
// to the notification store rather than polling. Renders nothing itself;
// mount it once in the app shell. The waving-hand mark lives on the
// badges (nav / hub tile / proposal); the alerts toast is text-only.
const messages = defineMessages({
  nudgeTitle: { id: 'nudge_toast.nudge.title', defaultMessage: 'New nudge' },
  nudgeMessage: {
    id: 'nudge_toast.nudge.message',
    defaultMessage: 'Someone waved at you.',
  },
  kronkTitle: { id: 'nudge_toast.kronk.title', defaultMessage: 'Kronk' },
  proposalReady: {
    id: 'nudge_toast.proposal.ready',
    defaultMessage: '{title} is ready to finalise.',
  },
  view: { id: 'nudge_toast.view', defaultMessage: 'View' },
});

export const NudgeArrivalToast: React.FC = () => {
  const dispatch = useAppDispatch();
  const history = useHistory();
  const latest = useAppSelector(selectLatestAlertNotification);
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latest) return;

    // First observed value: remember it so pre-existing notifications
    // present at load don't fire a toast. Only genuinely newer ones do.
    if (seenRef.current === null) {
      seenRef.current = latest.id;
      return;
    }

    if (compareId(latest.id, seenRef.current) <= 0) return;
    seenRef.current = latest.id;

    const isProposal = latest.proposalTitle !== null;
    dispatch(
      showAlert({
        title: isProposal ? messages.kronkTitle : messages.nudgeTitle,
        message: isProposal ? messages.proposalReady : messages.nudgeMessage,
        values: isProposal ? { title: latest.proposalTitle ?? '' } : undefined,
        action: messages.view,
        onClick: () => {
          history.push('/nudges');
        },
      }),
    );
  }, [latest, dispatch, history]);

  return null;
};
