import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { KuestionVisibilityScope } from 'mastodon/api_types/kuestions';

// Four-position visibility dial aligned with the platform reach
// ladder (docs/kronk_feed_and_reach.md §2). Order matters — the
// track reads left → right as widest → tightest.
export const SCOPE_ORDER: KuestionVisibilityScope[] = [
  'public',
  'orbit',
  'mates',
  'self_only',
];

const messages = defineMessages({
  public: {
    id: 'kuestions.scope.public',
    defaultMessage: 'Kronkverse',
  },
  publicNote: {
    id: 'kuestions.scope.public_note',
    defaultMessage: 'Everyone on Kronk can see this answer.',
  },
  orbit: {
    id: 'kuestions.scope.orbit',
    defaultMessage: 'Orbit',
  },
  orbitNote: {
    id: 'kuestions.scope.orbit_note',
    defaultMessage: 'Your mates and their mates can see this answer.',
  },
  mates: {
    id: 'kuestions.scope.mates',
    defaultMessage: 'Mates',
  },
  matesNote: {
    id: 'kuestions.scope.mates_note',
    defaultMessage: 'Only your mutual connections can see this answer.',
  },
  selfOnly: {
    id: 'kuestions.scope.self_only',
    defaultMessage: 'Just me',
  },
  selfOnlyNote: {
    id: 'kuestions.scope.self_only_note',
    defaultMessage: 'Private. A note to yourself.',
  },
  visibleTo: {
    id: 'kuestions.scope.visible_to',
    defaultMessage: 'Answer visible to',
  },
});

const LABEL: Record<
  KuestionVisibilityScope,
  { label: typeof messages.public; note: typeof messages.publicNote }
> = {
  public: { label: messages.public, note: messages.publicNote },
  orbit: { label: messages.orbit, note: messages.orbitNote },
  mates: { label: messages.mates, note: messages.matesNote },
  self_only: { label: messages.selfOnly, note: messages.selfOnlyNote },
};

interface VisibilityDialProps {
  value: KuestionVisibilityScope;
  onChange: (next: KuestionVisibilityScope) => void;
  // Whether to render the human-readable note under the pills. The
  // dial is used in two places: on the answer sheet (with note) and
  // on settings (with note). Kept optional for future compact usages.
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
