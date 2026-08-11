import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import ExpandMoreIcon from '@/material-icons/400-24px/expand_more.svg?react';
import { Icon } from 'mastodon/components/icon';
import type { MarkKind } from 'mastodon/components/scope_mark';
import { ScopeMark } from 'mastodon/components/scope_mark';

// ReachDropdown — the "who can see this?" control as a compact dropdown that
// sits in the composer header (where a post's audience shows in the feed). Same
// ring-mark glyphs + vocabulary as the feed scope: Me / Mates / Orbit /
// Kronkverse. Pure controlled input (value / onChange).
//
// Krew is an ORTHOGONAL, additive audience axis (not a reach tier — see
// docs/rebuild/krew_axis_migration.md). When a call site passes `krews` +
// `onToggleKrew`, the menu grows a "Krews ›" row that flies out into a
// multi-select submenu; ticking krews does NOT change the reach tier, it adds
// their members on top. Call sites that don't support krew just omit those
// props and get a plain reach picker.

export type ReachValue = 'self_only' | 'mates' | 'orbit' | 'public' | 'krew';

export interface KrewOption {
  id: string;
  name: string;
  hint?: string;
}

const messages = defineMessages({
  aria: { id: 'reach.aria', defaultMessage: 'Who can see this?' },
  me: { id: 'reach.me', defaultMessage: 'Me' },
  mates: { id: 'reach.mates', defaultMessage: 'Mates' },
  orbit: { id: 'reach.orbit', defaultMessage: 'Orbit' },
  kronk: { id: 'reach.kronk', defaultMessage: 'Kronkverse' },
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
  krewsRow: { id: 'reach.krews.row', defaultMessage: 'Krews' },
  krewsRowHint: {
    id: 'reach.krews.row_hint',
    defaultMessage: 'Add any — seen on top of your reach',
  },
  krewsTitle: { id: 'reach.krews.title', defaultMessage: 'Add krews' },
  krewsEmpty: { id: 'reach.krews.empty', defaultMessage: 'No krews yet.' },
  krewsSubHint: {
    id: 'reach.krews.sub_hint',
    defaultMessage:
      'Members of these krews see the post even if your reach wouldn’t include them.',
  },
  krewCount: {
    id: 'reach.krews.count',
    defaultMessage: '· {count, plural, one {# krew} other {# krews}}',
  },
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
  // Additive krew axis (optional). Provide both to grow the "Krews ›"
  // submenu; `krews` is the viewer's selectable krews, `selectedKrewIds` the
  // current picks, `onToggleKrew` adds/removes one. Krew selection is
  // independent of `value` — it does not change the reach tier.
  krews?: readonly KrewOption[];
  selectedKrewIds?: readonly string[];
  onToggleKrew?: (id: string) => void;
  // Single-krew korners (e.g. Moments, whose model holds one `krew_id`) render
  // the submenu as a radio list — picking one clears the rest. Multi-select by
  // default; the call site still enforces the constraint in `onToggleKrew`.
  krewSingleSelect?: boolean;
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

const KrewSubmenuItem: React.FC<{
  krew: KrewOption;
  checked: boolean;
  single: boolean;
  onToggle: (id: string) => void;
}> = ({ krew, checked, single, onToggle }) => {
  const handleClick = useCallback(() => {
    onToggle(krew.id);
  }, [onToggle, krew.id]);

  return (
    <button
      type='button'
      role={single ? 'menuitemradio' : 'menuitemcheckbox'}
      aria-checked={checked}
      onClick={handleClick}
      className={`reach-dropdown__krew${checked ? ' reach-dropdown__krew--checked' : ''}`}
    >
      <span
        className={`reach-dropdown__krew-box${single ? ' reach-dropdown__krew-box--radio' : ''}`}
      >
        <Icon id='' icon={CheckIcon} className='reach-dropdown__krew-check' />
      </span>
      <span className='reach-dropdown__item-text'>
        <span className='reach-dropdown__item-label'>{krew.name}</span>
        {krew.hint && (
          <span className='reach-dropdown__item-hint'>{krew.hint}</span>
        )}
      </span>
    </button>
  );
};

export const ReachDropdown: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  hide,
  krews,
  selectedKrewIds,
  onToggleKrew,
  krewSingleSelect = false,
}) => {
  const hideSet = new Set<ReachValue>(hide ?? []);
  const visibleOrder = ORDER.filter((o) => !hideSet.has(o));
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = REACH_META[value];

  const krewEnabled = krews !== undefined && onToggleKrew !== undefined;
  const selectedKrews = selectedKrewIds ?? [];

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

  // Collapse the submenu whenever the menu closes.
  useEffect(() => {
    if (!open) setSubOpen(false);
  }, [open]);

  const toggle = useCallback(() => {
    if (!disabled) setOpen((o) => !o);
  }, [disabled]);

  const handleSelect = useCallback(
    (v: ReachValue) => {
      onChange(v);
      // With the additive krew submenu present the user may still want to add
      // krews, so keep the menu open; a plain reach picker closes on choice.
      if (!krewEnabled) setOpen(false);
    },
    [onChange, krewEnabled],
  );

  const toggleSub = useCallback(() => {
    setSubOpen((s) => !s);
  }, []);

  const openSub = useCallback(() => {
    setSubOpen(true);
  }, []);

  const handleToggleKrew = useCallback(
    (id: string) => {
      onToggleKrew?.(id);
    },
    [onToggleKrew],
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
        {krewEnabled && selectedKrews.length > 0 && (
          <span className='reach-dropdown__button-krewcount'>
            {intl.formatMessage(messages.krewCount, {
              count: selectedKrews.length,
            })}
          </span>
        )}
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

          {krewEnabled && (
            <div className='reach-dropdown__sub-anchor'>
              <div className='reach-dropdown__divider' />
              <button
                type='button'
                className={`reach-dropdown__item reach-dropdown__krews-row${subOpen ? ' reach-dropdown__krews-row--open' : ''}`}
                aria-haspopup='menu'
                aria-expanded={subOpen}
                onClick={toggleSub}
                onMouseEnter={openSub}
              >
                <ScopeMark
                  kind='krews'
                  size={24}
                  className='reach-dropdown__item-mark'
                />
                <span className='reach-dropdown__item-text'>
                  <span className='reach-dropdown__item-label'>
                    {intl.formatMessage(messages.krewsRow)}
                  </span>
                  <span className='reach-dropdown__item-hint'>
                    {intl.formatMessage(messages.krewsRowHint)}
                  </span>
                </span>
                {selectedKrews.length > 0 && (
                  <span className='reach-dropdown__krew-count'>
                    {selectedKrews.length}
                  </span>
                )}
                <Icon
                  id=''
                  icon={ChevronRightIcon}
                  className='reach-dropdown__caret'
                />
              </button>

              {subOpen && (
                <div className='reach-dropdown__submenu' role='menu'>
                  <div className='reach-dropdown__submenu-title'>
                    {intl.formatMessage(messages.krewsTitle)}
                  </div>
                  {krews.length === 0 ? (
                    <p className='reach-dropdown__submenu-empty'>
                      {intl.formatMessage(messages.krewsEmpty)}
                    </p>
                  ) : (
                    krews.map((krew) => (
                      <KrewSubmenuItem
                        key={krew.id}
                        krew={krew}
                        checked={selectedKrews.includes(krew.id)}
                        single={krewSingleSelect}
                        onToggle={handleToggleKrew}
                      />
                    ))
                  )}
                  {krews.length > 0 && (
                    <p className='reach-dropdown__submenu-hint'>
                      {intl.formatMessage(messages.krewsSubHint)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
