import { defineMessages, useIntl } from 'react-intl';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import { Icon } from 'mastodon/components/icon';

const messages = defineMessages({
  askedQuestion: {
    id: 'status_space_bar.asked_question',
    defaultMessage: 'asked a question',
  },
  answeredQuestion: {
    id: 'status_space_bar.answered_question',
    defaultMessage: 'answered a question',
  },
  createdEvent: {
    id: 'status_space_bar.created_event',
    defaultMessage: 'created an event',
  },
  openedProposal: {
    id: 'status_space_bar.opened_proposal',
    defaultMessage: 'opened a proposal',
  },
});

interface SpaceConfig {
  iconComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  iconId: string;
  verbKey: keyof typeof messages;
}

function getConfig(
  postType: string | undefined,
  hasEvent: boolean,
): SpaceConfig | null {
  if (postType === 'question') {
    return {
      iconComponent: QuestionMarkIcon,
      iconId: 'question_mark',
      verbKey: 'askedQuestion',
    };
  }

  if (postType === 'answer') {
    return {
      iconComponent: QuestionMarkIcon,
      iconId: 'question_mark',
      verbKey: 'answeredQuestion',
    };
  }

  if (hasEvent) {
    return {
      iconComponent: CalendarMonthIcon,
      iconId: 'calendar_month',
      verbKey: 'createdEvent',
    };
  }

  if (postType === 'proposal') {
    return {
      iconComponent: CampaignIcon,
      iconId: 'campaign',
      verbKey: 'openedProposal',
    };
  }

  return null;
}

export const StatusSpaceBar: React.FC<{
  postType?: string;
  hasEvent?: boolean;
  inline?: boolean;
}> = ({ postType, hasEvent = false, inline = false }) => {
  const intl = useIntl();
  const config = getConfig(postType, hasEvent);

  if (!config) return null;

  if (inline) {
    return (
      <span className='status-space-bar status-space-bar--inline'>
        <Icon
          id={config.iconId}
          icon={config.iconComponent}
          className='status-space-bar__icon'
        />
        <span className='status-space-bar__verb'>
          {intl.formatMessage(messages[config.verbKey])}
        </span>
      </span>
    );
  }

  return (
    <div className='status-space-bar'>
      <Icon
        id={config.iconId}
        icon={config.iconComponent}
        className='status-space-bar__icon'
      />
      <span className='status-space-bar__verb'>
        {intl.formatMessage(messages[config.verbKey])}
      </span>
    </div>
  );
};
