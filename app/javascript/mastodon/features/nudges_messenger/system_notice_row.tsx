import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ChoiceIcon from '@/material-icons/400-24px/choice.svg?react';
import ConstructionIcon from '@/material-icons/400-24px/construction.svg?react';
import DoneAllIcon from '@/material-icons/400-24px/done_all.svg?react';
import MailIcon from '@/material-icons/400-24px/mail-fill.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';

import type { KronkSystemGroup } from './kronk_system';
import { NotificationRowShell } from './notification_row';

// Notices that come from Kronk and not from a person: a proposal ready to
// finalise, a block vote, a task, the confirm-your-email reminder. They are
// still written to the classic Notification store (docs/spaces/nudges.md,
// Retiring legacy notifications), so they arrive as notification groups and
// are drawn here in the same row shape as everything else on the face.

const messages = defineMessages({
  proposalUpdate: {
    id: 'nudges.notification.system.proposal_update',
    defaultMessage: 'A proposal you are part of has moved on',
  },
  proposalChallenged: {
    id: 'nudges.notification.system.proposal_challenged',
    defaultMessage: 'Your proposal was challenged by a block vote',
  },
  taskAssigned: {
    id: 'nudges.notification.system.task_assigned',
    defaultMessage: 'A task was assigned to you',
  },
  followedUp: {
    id: 'nudges.notification.system.followed_up',
    defaultMessage: 'Followed up',
  },
  confirmEmail: {
    id: 'nudges.notification.system.confirm_email',
    defaultMessage: 'Confirm your email',
  },
  confirmEmailBodyWithEmail: {
    id: 'nudges.notification.system.confirm_email.body_with_email',
    defaultMessage:
      'Check your inbox for the link we sent to {email}. Not there? Resend or change the address.',
  },
  confirmEmailBody: {
    id: 'nudges.notification.system.confirm_email.body',
    defaultMessage:
      'Check your inbox for the confirmation link. Not there? Resend or change the address.',
  },
});

const SystemMark: React.FC<{ id: string; icon: IconProp }> = ({ id, icon }) => (
  <span className='nudges-notification__mark'>
    <Icon id={id} icon={icon} />
  </span>
);

interface Props {
  group: KronkSystemGroup;
  fresh: boolean;
  // Proposal ids the viewer has already clicked through to. Those rows
  // recede, so what still needs a response stays distinct.
  visited: Set<string>;
  onVisit: (proposalId: string) => void;
}

export const SystemNoticeRow: React.FC<Props> = ({
  group,
  fresh,
  visited,
  onVisit,
}) => {
  const intl = useIntl();

  const proposalId =
    group.type === 'task_assigned'
      ? group.task?.proposal_id
      : group.type === 'email_confirmation_reminder'
        ? undefined
        : group.proposal?.proposal_id;

  const handleClick = useCallback(() => {
    if (proposalId) onVisit(proposalId);
  }, [proposalId, onVisit]);

  if (group.type === 'email_confirmation_reminder') {
    const email = group.emailConfirmationEmail;
    return (
      // A full navigation, not a route: /auth/setup is served by Rails,
      // outside the SPA.
      <NotificationRowShell
        href='/auth/setup'
        fresh={fresh}
        timestamp={group.latest_page_notification_at}
        media={<SystemMark id='mail' icon={MailIcon} />}
        sentence={<strong>{intl.formatMessage(messages.confirmEmail)}</strong>}
        subject={
          email
            ? intl.formatMessage(messages.confirmEmailBodyWithEmail, { email })
            : intl.formatMessage(messages.confirmEmailBody)
        }
      />
    );
  }

  if (!proposalId) return null;

  const done = visited.has(proposalId);
  let sentence: string;
  let title: string;
  let mark: React.ReactNode;

  switch (group.type) {
    case 'task_assigned':
      sentence = intl.formatMessage(messages.taskAssigned);
      title = group.task?.task_title ?? '';
      mark = <SystemMark id='construction' icon={ConstructionIcon} />;
      break;
    case 'proposal_challenged':
      sentence = intl.formatMessage(messages.proposalChallenged);
      title = group.proposal?.proposal_title ?? '';
      mark = <SystemMark id='choice' icon={ChoiceIcon} />;
      break;
    case 'proposal_status_changed':
      sentence = intl.formatMessage(messages.proposalUpdate);
      title = group.proposal?.proposal_title ?? '';
      mark = <SystemMark id='done_all' icon={DoneAllIcon} />;
      break;
  }

  return (
    <NotificationRowShell
      to={`/hub/kommons/p/${proposalId}`}
      fresh={fresh && !done}
      quiet={done}
      timestamp={group.latest_page_notification_at}
      media={mark}
      sentence={done ? intl.formatMessage(messages.followedUp) : sentence}
      subject={title}
      onClick={handleClick}
    />
  );
};
