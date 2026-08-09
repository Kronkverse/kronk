import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import ExpandMoreIcon from '@/material-icons/400-24px/expand_more.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { MarkKind } from 'mastodon/components/scope_mark';
import { ScopeMark } from 'mastodon/components/scope_mark';

// ReachDropdown — the "who can see this?" control as a compact dropdown that
// sits in the composer header (where a post's audience shows in the feed). Same
// ring-mark glyphs + vocabulary as the feed scope: Me / Mates / Orbit / Kronk +
// Krew. Pure controlled input (value / onChange); the krew sub-picker + any side
// effects live at the call site.

export type ReachValue = 'self_only' | 'mates' | 'orbit' | 'public' | 'krew';

const messages = defineMessages({
  aria: { id: 'reach.aria', defaultMessage: 'Who can see this?' },
  me: { id: 'reach.me', defaultMessage: 'Me' },
  mates: { id: 'reach.mates', defaultMessage: 'Mates' },
  orbit: { id: 'reach.orbit', defaultMessage: 'Orbit' },
  kronk: { id: 'reach.kronk', defaultMessage: 'Kronk' },
  krew: { id: 'reach.krew', defaultMessage: 'Krew' },
  meHint: { id: 'reach.me_hint', defaultMessage: 'Only you' },
  matesHint: {
    id: 'reach.mates_hint',
    defaultMessage: 'People who mate you back',
  },
  orbitHint: {
    id: 'reach.orbit_hint',
    defaultMessage: 'Your mates, and theirs',
  },
  kronkHint: { id: 'reach.kronk_hint', defaultMessage: 'Everyone on Kronk' },
  krewHint: { id: 'reach.krew_hint', defaultMessage: 'The krews you pick' },
});

interface Meta {
  mark: MarkKind;
  labelId: keyof typeof messages;
  hintId: keyof typeof messages;
}

const REACH_META: Record<ReachValue, Meta> = {
  self_only: { mark: 'self', labelId: 'me', hintId: 'meHint' },
  mates: { mark: 'mates', labelId: 'mates', hintId: 'matesHint' },
  orbit: { mark: 'orbit', labelId: 'orbit', hintId: 'orbitHint' },
  public: { mark: 'kronk', labelId: 'kronk', hintId: 'kronkHint' },
  krew: { mark: 'krews', labelId: 'krew', hintId: 'krewHint' },
};

// Narrow -> wide, Krew trailing.
const ORDER: readonly ReachValue[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
  'krew',
];

interface Props {
  value: ReachValue;
  onChange: (value: ReachValue) => void;
  disabled?: boolean;
  // Rungs to drop from the menu — e.g. Moments hides `self_only`
  // because a Moment is an ephemeral piece of social sharing; an
  // audience-of-one there is a private journal, not the feature (spec:
  // docs/spaces/moments.md § Reach). Defaults to no filtering.
  hide?: readonly ReachValue[];
}

const ReachMenuItem: React.FC<{
  option: ReachValue;
  selected: boolean;
  label: string;
  hint: string;
  onSelect: (value: ReachValue) => void;
}> = ({ option, selected, label, hint, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(option);
  }, [onSelect, option]);

  return (
    <button
      type='button'
      role='option'
      aria-selected={selected}
      onClick={handleClick}
      className={`reach-dropdown__item${selected ? ' reach-dropdown__item--selected' : ''}`}
    >
      <ScopeMark
        kind={REACH_META[option].mark}
        size={24}
        className='reach-dropdown__item-mark'
      />
      <span className='reach-dropdown__item-text'>
        <span className='reach-dropdown__item-label'>{label}</span>
        <span className='reach-dropdown__item-hint'>{hint}</span>
      </span>
      <Icon id='' icon={CheckIcon} className='reach-dropdown__item-tick' />
    </button>
  );
};

export const ReachDropdown: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  hide,
}) => {
  const hideSet = new Set<ReachValue>(hide ?? []);
  const visibleOrder = ORDER.filter((o) => !hideSet.has(o));
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = REACH_META[value];

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled) setOpen((o) => !o);
  }, [disabled]);

  const handleSelect = useCallback(
    (v: ReachValue) => {
      onChange(v);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div className='reach-dropdown' ref={wrapRef}>
      <button
        type='button'
        className='reach-dropdown__button'
        aria-haspopup='listbox'
        aria-expanded={open}
        title={intl.formatMessage(messages.aria)}
        disabled={disabled}
        onClick={toggle}
      >
        <ScopeMark
          kind={current.mark}
          size={20}
          className='reach-dropdown__button-mark'
        />
        <span className='reach-dropdown__button-label'>
          {intl.formatMessage(messages[current.labelId])}
        </span>
        <Icon id='' icon={ExpandMoreIcon} className='reach-dropdown__chevron' />
      </button>

      {open && (
        <div className='reach-dropdown__menu' role='listbox'>
          {visibleOrder.map((option) => (
            <ReachMenuItem
              key={option}
              option={option}
              selected={option === value}
              label={intl.formatMessage(messages[REACH_META[option].labelId])}
              hint={intl.formatMessage(messages[REACH_META[option].hintId])}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};
