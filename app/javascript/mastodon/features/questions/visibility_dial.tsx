import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KuestionVisibilityScope } from 'mastodon/api_types/kuestions';

// 5-position visibility dial matching the prototype. Order matters —
// left → right widens from most-private to most-public in reverse,
// following the prototype's dial arrangement.
export const SCOPE_ORDER: KuestionVisibilityScope[] = [
  'everyone',
  'kronk_members',
  'connections',
  'vouched',
  'only_me',
];

const messages = defineMessages({
  everyone: {
    id: 'kuestions.scope.everyone',
    defaultMessage: 'Everyone',
  },
  everyoneNote: {
    id: 'kuestions.scope.everyone_note',
    defaultMessage: 'Federated. Anyone on the fediverse can see and answer.',
  },
  kronkMembers: {
    id: 'kuestions.scope.kronk_members',
    defaultMessage: 'Kronk members',
  },
  kronkMembersNote: {
    id: 'kuestions.scope.kronk_members_note',
    defaultMessage: 'Anyone with a Kronk account can see and answer.',
  },
  connections: {
    id: 'kuestions.scope.connections',
    defaultMessage: 'Connections',
  },
  connectionsNote: {
    id: 'kuestions.scope.connections_note',
    defaultMessage: "People you're connected with can see this.",
  },
  vouched: { id: 'kuestions.scope.vouched', defaultMessage: 'Vouched' },
  vouchedNote: {
    id: 'kuestions.scope.vouched_note',
    defaultMessage: 'Only people vouched for by someone you trust.',
  },
  onlyMe: { id: 'kuestions.scope.only_me', defaultMessage: 'Only me' },
  onlyMeNote: {
    id: 'kuestions.scope.only_me_note',
    defaultMessage: 'Private. A note to yourself.',
  },
  visibleTo: {
    id: 'kuestions.scope.visible_to',
    defaultMessage: 'Answer visible to',
  },
});

const LABEL: Record<
  KuestionVisibilityScope,
  { label: typeof messages.everyone; note: typeof messages.everyoneNote }
> = {
  everyone: { label: messages.everyone, note: messages.everyoneNote },
  kronk_members: {
    label: messages.kronkMembers,
    note: messages.kronkMembersNote,
  },
  connections: { label: messages.connections, note: messages.connectionsNote },
  vouched: { label: messages.vouched, note: messages.vouchedNote },
  only_me: { label: messages.onlyMe, note: messages.onlyMeNote },
};

interface VisibilityDialProps {
  value: KuestionVisibilityScope;
  onChange: (next: KuestionVisibilityScope) => void;
  // Whether to render the human-readable note under the pills. The
  // dial is used in two places: on the answer sheet (with note) and
  // (later) on settings (with note). Kept optional for future compact
  // usages.
  withNote?: boolean;
}

export const VisibilityDial: React.FC<VisibilityDialProps> = ({
  value,
  onChange,
  withNote = true,
}) => {
  const intl = useIntl();
  const activeIndex = SCOPE_ORDER.indexOf(value);

  return (
    <div className='kuestions-dial'>
      <div className='kuestions-dial__head'>
        <span>{intl.formatMessage(messages.visibleTo)}</span>
        <strong className='kuestions-dial__label'>
          {intl.formatMessage(LABEL[value].label)}
        </strong>
      </div>
      <div className='kuestions-dial__track'>
        {SCOPE_ORDER.map((scope, idx) => (
          <DialStop
            key={scope}
            scope={scope}
            active={idx === activeIndex}
            onSelect={onChange}
            label={intl.formatMessage(LABEL[scope].label)}
          />
        ))}
      </div>
      {withNote && (
        <p className='kuestions-dial__note'>
          {intl.formatMessage(LABEL[value].note)}
        </p>
      )}
    </div>
  );
};

interface DialStopProps {
  scope: KuestionVisibilityScope;
  active: boolean;
  label: string;
  onSelect: (scope: KuestionVisibilityScope) => void;
}

const DialStop: React.FC<DialStopProps> = ({
  scope,
  active,
  label,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(scope);
  }, [onSelect, scope]);

  return (
    <button
      type='button'
      className={`kuestions-dial__stop kuestions-dial__stop--${scope} ${active ? 'kuestions-dial__stop--active' : ''}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={handleClick}
    />
  );
};
