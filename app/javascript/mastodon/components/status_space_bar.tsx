import { defineMessages, useIntl } from 'react-intl';

import { Icon } from 'mastodon/components/icon';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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

// Which korner the space bar attributes each post type to. The icon
// itself is read from that korner's manifest (`icon.material` in
// `config/korners/<slug>.yaml`) via `useKornerIcon` — so renaming the
// glyph in the manifest surfaces here without a code change. Was a
// hardcoded per-postType icon before (question_mark / calendar_month
// / campaign); switched to the manifest source of truth 2026-08-06
// after Tal flagged that arbitrary picks in this component and the
// korner card / chrome drift apart.
interface SpaceConfig {
  kornerSlug: string;
  verbKey: keyof typeof messages;
}

function getConfig(
  postType: string | undefined,
  hasEvent: boolean,
): SpaceConfig | null {
  if (postType === 'question') {
    return { kornerSlug: 'kuestions', verbKey: 'askedQuestion' };
  }

  if (postType === 'answer') {
    return { kornerSlug: 'kuestions', verbKey: 'answeredQuestion' };
  }

  if (hasEvent) {
    return { kornerSlug: 'kalendar', verbKey: 'createdEvent' };
  }

  if (postType === 'proposal') {
    return { kornerSlug: 'kommons', verbKey: 'openedProposal' };
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
  // `useKornerIcon(undefined)` returns the AccentCircle fallback, so
  // calling this unconditionally (React hook rule) is safe even when
  // `config` is null — we bail out with `return null` below and the
  // resolved icon is discarded.
  const IconComponent = useKornerIcon(config?.kornerSlug);

  if (!config) return null;

  const iconEl = (
    <Icon
      id={config.kornerSlug}
      icon={IconComponent}
      className='status-space-bar__icon'
    />
  );
  const verbEl = (
    <span className='status-space-bar__verb'>
      {intl.formatMessage(messages[config.verbKey])}
    </span>
  );

  if (inline) {
    return (
      <span className='status-space-bar status-space-bar--inline'>
        {iconEl}
        {verbEl}
      </span>
    );
  }

  return (
    <div className='status-space-bar'>
      {iconEl}
      {verbEl}
    </div>
  );
};
