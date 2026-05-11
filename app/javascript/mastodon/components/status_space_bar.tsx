import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
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
});

interface SpaceConfig {
  iconComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  iconId: string;
  verbKey: keyof typeof messages;
  spaceName: string;
  spacePath: string;
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
      spaceName: '₭uestions',
      spacePath: '/questions',
    };
  }

  if (postType === 'answer') {
    return {
      iconComponent: QuestionMarkIcon,
      iconId: 'question_mark',
      verbKey: 'answeredQuestion',
      spaceName: '₭uestions',
      spacePath: '/questions',
    };
  }

  if (hasEvent) {
    return {
      iconComponent: CalendarMonthIcon,
      iconId: 'calendar_month',
      verbKey: 'createdEvent',
      spaceName: '₭alendar',
      spacePath: '/kalendar',
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

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

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
        <span className='status-space-bar__sep' aria-hidden='true'>
          ·
        </span>
        <Link
          to={config.spacePath}
          className='status-space-bar__space-link'
          onClick={handleLinkClick}
        >
          {config.spaceName}
        </Link>
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
      <span className='status-space-bar__sep' aria-hidden='true'>
        ·
      </span>
      <Link
        to={config.spacePath}
        className='status-space-bar__space-link'
        onClick={handleLinkClick}
      >
        {config.spaceName}
      </Link>
    </div>
  );
};
