import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import type { MarkKind } from 'mastodon/components/scope_mark';
import { ScopeMark } from 'mastodon/components/scope_mark';

// ReachSelector — the shared "who can see this?" control. One audience ladder,
// drawn with the same concentric-ring glyphs as the feed scope: Me -> Mates ->
// Orbit -> Kronk, plus a distinct Krew face that reveals a krew sub-picker (Krew
// is a group target, not a rung on the ladder). Pure controlled input: parent
// owns `value` + `krewIds` and their setters, so every call site (the post
// composer, korner composers, the two-axis ScopePicker) shares one selector and
// keeps its own side effects.

export type ReachValue = 'self_only' | 'mates' | 'orbit' | 'public' | 'krew';

const messages = defineMessages({
  question: {
    id: 'reach_selector.question',
    defaultMessage: 'Who can see this?',
  },
  me: { id: 'reach_selector.me', defaultMessage: 'Me' },
  mates: { id: 'reach_selector.mates', defaultMessage: 'Mates' },
  orbit: { id: 'reach_selector.orbit', defaultMessage: 'Orbit' },
  kronk: { id: 'reach_selector.kronk', defaultMessage: 'Kronk' },
  krew: { id: 'reach_selector.krew', defaultMessage: 'Krew' },
  meHint: { id: 'reach_selector.me_hint', defaultMessage: 'Only you.' },
  matesHint: {
    id: 'reach_selector.mates_hint',
    defaultMessage: 'People who mate you back.',
  },
  orbitHint: {
    id: 'reach_selector.orbit_hint',
    defaultMessage: 'Your mates, and theirs.',
  },
  kronkHint: {
    id: 'reach_selector.kronk_hint',
    defaultMessage: 'Everyone on Kronk.',
  },
  krewHint: {
    id: 'reach_selector.krew_hint',
    defaultMessage: 'The krews you pick.',
  },
  krewWhich: {
    id: 'reach_selector.krew_which',
    defaultMessage: 'Which krews?',
  },
  krewEmpty: {
    id: 'reach_selector.krew_empty',
    defaultMessage: "You aren't in any krews yet.",
  },
});

interface ReachOption {
  value: ReachValue;
  mark: MarkKind;
  labelId: keyof typeof messages;
  hintId: keyof typeof messages;
}

// Narrow -> wide, Krew trailing (a group target, off the ladder).
const REACH_OPTIONS: readonly ReachOption[] = [
  { value: 'self_only', mark: 'self', labelId: 'me', hintId: 'meHint' },
  { value: 'mates', mark: 'mates', labelId: 'mates', hintId: 'matesHint' },
  { value: 'orbit', mark: 'orbit', labelId: 'orbit', hintId: 'orbitHint' },
  { value: 'public', mark: 'kronk', labelId: 'kronk', hintId: 'kronkHint' },
  { value: 'krew', mark: 'krews', labelId: 'krew', hintId: 'krewHint' },
];

interface Props {
  value: ReachValue;
  onChange: (value: ReachValue) => void;
  krewIds: string[];
  onKrewIdsChange: (ids: string[]) => void;
  // Restrict / reorder the ladder for a surface that supports fewer tiers.
  // Defaults to the full ladder.
  options?: readonly ReachValue[];
  disabled?: boolean;
}

// One ladder chip — its own component so onClick is a stable callback rather
// than an inline arrow in the map (react/jsx-no-bind).
const ReachChip: React.FC<{
  option: ReachOption;
  selected: boolean;
  disabled: boolean;
  label: string;
  hint: string;
  onSelect: (value: ReachValue) => void;
}> = ({ option, selected, disabled, label, hint, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(option.value);
  }, [onSelect, option.value]);

  return (
    <button
      type='button'
      role='radio'
      aria-checked={selected}
      title={hint}
      disabled={disabled}
      onClick={handleClick}
      className={`reach-selector__chip${selected ? ' reach-selector__chip--selected' : ''}`}
    >
      <ScopeMark
        kind={option.mark}
        size={30}
        className='reach-selector__mark'
      />
      <span className='reach-selector__chip-label'>{label}</span>
    </button>
  );
};

// One krew toggle in the sub-picker.
const KrewChip: React.FC<{
  krew: ApiKrewJSON;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
}> = ({ krew, selected, disabled, onToggle }) => {
  const handleClick = useCallback(() => {
    onToggle(krew.id);
  }, [onToggle, krew.id]);

  return (
    <button
      type='button'
      aria-pressed={selected}
      disabled={disabled}
      onClick={handleClick}
      className={`reach-selector__krew${selected ? ' reach-selector__krew--selected' : ''}`}
    >
      {krew.name}
    </button>
  );
};

export const ReachSelector: React.FC<Props> = ({
  value,
  onChange,
  krewIds,
  onKrewIdsChange,
  options,
  disabled = false,
}) => {
  const intl = useIntl();
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);

  const shown = options
    ? REACH_OPTIONS.filter((o) => options.includes(o.value))
    : REACH_OPTIONS;

  // Fetch the viewer's krews once, lazily — only when the Krew face is in play.
  const needsKrews = value === 'krew';
  useEffect(() => {
    if (!needsKrews || krews.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<ApiKrewJSON[]>('v1/krews', {
          limit: 100,
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `cancelled` flips in the cleanup below after this reads it; TS can't track the mutation across the closure, but the guard prevents a setState after unmount.
        if (!cancelled) {
          setKrews(data.filter((k) => k.viewer_role !== null && !k.archived));
        }
      } catch {
        // Best-effort — the selector stays usable without the krew list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsKrews, krews.length]);

  const toggleKrew = useCallback(
    (id: string) => {
      onKrewIdsChange(
        krewIds.includes(id)
          ? krewIds.filter((x) => x !== id)
          : [...krewIds, id],
      );
    },
    [krewIds, onKrewIdsChange],
  );

  return (
    <div className='reach-selector'>
      <div className='reach-selector__question' id='reach-selector-question'>
        {intl.formatMessage(messages.question)}
      </div>

      <div
        className='reach-selector__ladder'
        role='radiogroup'
        aria-labelledby='reach-selector-question'
      >
        {shown.map((option) => (
          <ReachChip
            key={option.value}
            option={option}
            selected={option.value === value}
            disabled={disabled}
            label={intl.formatMessage(messages[option.labelId])}
            hint={intl.formatMessage(messages[option.hintId])}
            onSelect={onChange}
          />
        ))}
      </div>

      {value === 'krew' && (
        <div className='reach-selector__krews'>
          <div className='reach-selector__krews-label'>
            {intl.formatMessage(messages.krewWhich)}
          </div>
          {krews.length === 0 ? (
            <p className='reach-selector__krews-empty'>
              {intl.formatMessage(messages.krewEmpty)}
            </p>
          ) : (
            <div className='reach-selector__krew-list'>
              {krews.map((krew) => (
                <KrewChip
                  key={krew.id}
                  krew={krew}
                  selected={krewIds.includes(krew.id)}
                  disabled={disabled}
                  onToggle={toggleKrew}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
