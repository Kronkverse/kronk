import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useKorner } from 'mastodon/hooks/useKorner';

// KornerVisibilityPicker — the shared visibility button-strip
// component read from a korner's manifest.
//
// Given a slug, it looks up `security.visibility_scopes` in the korner
// registry and renders one button per declared scope, in canonical
// order (public → orbit → mates → self_only → krew). Every korner that
// composes a Status (album, moment, kuestion ask, etc.) uses this so
// the vocabulary + label copy is defined once and every composer picks
// up manifest changes automatically.
//
// Kuestions Answer still uses its bespoke `<VisibilityDial>` for its
// distinctive horizontal-track look; Trek's reach picker on the map
// composer is separate too. Both can adopt this shared component later
// if we decide the button strip is universally right.
//
// See docs/kronk_feed_and_reach.md §2 for the reach ladder.

const messages = defineMessages({
  public: {
    id: 'korner.visibility.public.label',
    defaultMessage: 'Kronkverse',
  },
  publicHelp: {
    id: 'korner.visibility.public.help',
    defaultMessage: 'Anyone on and off kronk',
  },
  orbit: {
    id: 'korner.visibility.orbit.label',
    defaultMessage: 'Orbit',
  },
  orbitHelp: {
    id: 'korner.visibility.orbit.help',
    defaultMessage: 'Your mates and their mates',
  },
  mates: {
    id: 'korner.visibility.mates.label',
    defaultMessage: 'Mates',
  },
  matesHelp: {
    id: 'korner.visibility.mates.help',
    defaultMessage: 'Your mutual connections only',
  },
  selfOnly: {
    id: 'korner.visibility.self_only.label',
    defaultMessage: 'Just me',
  },
  selfOnlyHelp: {
    id: 'korner.visibility.self_only.help',
    defaultMessage: 'On your profile only — not in anyone else’s feed',
  },
  krew: {
    id: 'korner.visibility.krew.label',
    defaultMessage: 'A krew',
  },
  krewHelp: {
    id: 'korner.visibility.krew.help',
    defaultMessage: 'Members of the krew(s) you pick',
  },
});

// Canonical render order across every korner. The manifest can
// declare a subset; we render each declared scope once, in this
// order. Anything the manifest declares that isn't in this list is
// silently skipped (unknown scopes need a component update; the
// composer shouldn't blindly render a button we don't understand).
const CANONICAL_ORDER = [
  'public',
  'orbit',
  'mates',
  'self_only',
  'krew',
] as const;
type CanonicalScope = (typeof CANONICAL_ORDER)[number];

const LABEL: Record<
  CanonicalScope,
  { label: typeof messages.public; help: typeof messages.publicHelp }
> = {
  public: { label: messages.public, help: messages.publicHelp },
  orbit: { label: messages.orbit, help: messages.orbitHelp },
  mates: { label: messages.mates, help: messages.matesHelp },
  self_only: { label: messages.selfOnly, help: messages.selfOnlyHelp },
  krew: { label: messages.krew, help: messages.krewHelp },
};

interface KornerVisibilityPickerProps {
  slug: string;
  value: string;
  onChange: (next: string) => void;
  // Optional whole-component disabled (e.g. while a submission is in
  // flight). Distinct from per-scope disabled (below).
  disabled?: boolean;
  // Scopes to render as disabled buttons (still shown for parity, but
  // unclickable). Useful for placeholders like Album's `krew` before
  // the krew picker lands.
  disabledScopes?: readonly string[];
  className?: string;
}

export const KornerVisibilityPicker: React.FC<KornerVisibilityPickerProps> = ({
  slug,
  value,
  onChange,
  disabled,
  disabledScopes = [],
  className,
}) => {
  const korner = useKorner(slug);
  const scopes = readScopes(korner);

  // Filter to canonical scopes in canonical order; ignore any the
  // manifest declares that this component doesn't know about.
  const renderable = CANONICAL_ORDER.filter((s) => scopes.includes(s));

  if (renderable.length === 0) return null;

  return (
    <div
      className={`korner-visibility-picker ${className ?? ''}`.trim()}
      role='radiogroup'
    >
      {renderable.map((scope) => (
        <Option
          key={scope}
          scope={scope}
          active={value === scope}
          disabled={disabled ?? disabledScopes.includes(scope)}
          onSelect={onChange}
        />
      ))}
    </div>
  );
};

function readScopes(
  korner: ReturnType<typeof useKorner>,
): readonly CanonicalScope[] {
  if (!korner) return CANONICAL_ORDER;
  const security = korner.security;
  if (!security || typeof security !== 'object') return CANONICAL_ORDER;
  const raw = (security as { visibility_scopes?: unknown }).visibility_scopes;
  if (!Array.isArray(raw)) return CANONICAL_ORDER;
  return raw.filter(
    (s): s is CanonicalScope =>
      typeof s === 'string' &&
      (CANONICAL_ORDER as readonly string[]).includes(s),
  );
}

interface OptionProps {
  scope: CanonicalScope;
  active: boolean;
  disabled: boolean;
  onSelect: (scope: string) => void;
}

const Option: React.FC<OptionProps> = ({
  scope,
  active,
  disabled,
  onSelect,
}) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onSelect(scope);
  }, [onSelect, scope]);

  const label = intl.formatMessage(LABEL[scope].label);
  const help = intl.formatMessage(LABEL[scope].help);

  return (
    <button
      type='button'
      role='radio'
      className={`korner-visibility-picker__opt korner-visibility-picker__opt--${scope} ${active ? 'korner-visibility-picker__opt--active' : ''}`}
      aria-checked={active}
      aria-label={`${label} — ${help}`}
      title={help}
      disabled={disabled}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};
