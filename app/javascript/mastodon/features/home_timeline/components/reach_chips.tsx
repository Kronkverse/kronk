/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * cancelled/mounted guards in the useEffect cleanup after async
 * fetches. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useState, useEffect, useCallback, useRef } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import ArrowDropDownIcon from '@/material-icons/400-24px/arrow_drop_down.svg?react';
import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';

// Home column reach chips. Three fixed distance tiers
// (Mates / Orbit / Kommunity) plus a Krew dropdown. The tier chips
// persist to /api/v1/kronk_settings.feed_scope; the Krew chip is
// session-only — it selects a Krew timeline for this visit only,
// reverting to the persisted reach on reload. Rationale + tier
// semantics: docs/kronk_feed_and_reach.md §2.

export type Reach = 'mates' | 'orbit' | 'kommunity';

export interface ReachSelection {
  reach: Reach;
  krew: ApiKrewJSON | null;
}

const messages = defineMessages({
  mates: { id: 'home.reach.mates', defaultMessage: 'Mates' },
  orbit: { id: 'home.reach.orbit', defaultMessage: 'Orbit' },
  kommunity: { id: 'home.reach.kommunity', defaultMessage: 'Kommunity' },
  krew: { id: 'home.reach.krew', defaultMessage: 'Krew' },
  krewMenu: { id: 'home.reach.krew_menu', defaultMessage: 'Choose a Krew' },
  noKrews: {
    id: 'home.reach.no_krews',
    defaultMessage: 'No Krews yet.',
  },
});

const TIER_OPTIONS: { value: Reach; messageKey: keyof typeof messages }[] = [
  { value: 'mates', messageKey: 'mates' },
  { value: 'orbit', messageKey: 'orbit' },
  { value: 'kommunity', messageKey: 'kommunity' },
];

interface Props {
  reach: Reach;
  activeKrew: ApiKrewJSON | null;
  onChange: (next: ReachSelection) => void;
}

// The Krew menu button + dropdown. Split out so the map iteration of
// menu items can bind their own callbacks (jsx-no-bind).
const KrewMenuItem: React.FC<{
  krew: ApiKrewJSON;
  active: boolean;
  onPick: (krew: ApiKrewJSON) => void;
}> = ({ krew, active, onPick }) => {
  const handleClick = useCallback(() => {
    onPick(krew);
  }, [onPick, krew]);

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`home-reach-chips__menu-item ${active ? 'home-reach-chips__menu-item--active' : ''}`}
      role='menuitemradio'
      aria-checked={active}
    >
      {krew.name}
    </button>
  );
};

export const ReachChips: React.FC<Props> = ({
  reach,
  activeKrew,
  onChange,
}) => {
  const intl = useIntl();
  const [saving, setSaving] = useState(false);
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
  const [krewsLoaded, setKrewsLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleDocClick = (e: MouseEvent) => {
      const root = menuRootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
    };
  }, [menuOpen]);

  const loadKrews = useCallback(async () => {
    if (krewsLoaded) return;
    try {
      const list = await apiGetKrews({ scope: 'mine', limit: 40 });
      setKrews(list);
    } catch {
      // Silent — the dropdown just shows the empty state.
    } finally {
      setKrewsLoaded(true);
    }
  }, [krewsLoaded]);

  const changeReach = useCallback(
    async (next: Reach) => {
      if (saving) return;
      if (next === reach && !activeKrew) return;
      const previous = reach;
      onChange({ reach: next, krew: null });
      setSaving(true);
      try {
        await apiRequestPut('v1/kronk_settings', { feed_scope: next });
      } catch {
        onChange({ reach: previous, krew: activeKrew });
      } finally {
        setSaving(false);
      }
    },
    [reach, activeKrew, saving, onChange],
  );

  const handleTierClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const value = e.currentTarget.dataset.reach as Reach | undefined;
      if (value) void changeReach(value);
    },
    [changeReach],
  );

  const handleKrewToggle = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) void loadKrews();
      return next;
    });
  }, [loadKrews]);

  const handleKrewPick = useCallback(
    (krew: ApiKrewJSON) => {
      onChange({ reach, krew });
      setMenuOpen(false);
    },
    [onChange, reach],
  );

  // Persist initial value on mount (once) so the picker reflects the
  // stored setting rather than the passed-in default from the parent.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<{ feed_scope: Reach }>(
          'v1/kronk_settings',
        );
        if (!cancelled && data.feed_scope && data.feed_scope !== reach) {
          onChange({ reach: data.feed_scope, krew: null });
        }
      } catch {
        // silent — the default reach stays
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='home-reach-chips' role='tablist' aria-label='Feed reach'>
      {TIER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type='button'
          role='tab'
          data-reach={opt.value}
          onClick={handleTierClick}
          className={`home-reach-chips__chip ${reach === opt.value && !activeKrew ? 'home-reach-chips__chip--active' : ''}`}
          aria-selected={reach === opt.value && !activeKrew}
        >
          {intl.formatMessage(messages[opt.messageKey])}
        </button>
      ))}

      <div className='home-reach-chips__krew' ref={menuRootRef}>
        <button
          type='button'
          onClick={handleKrewToggle}
          className={`home-reach-chips__chip home-reach-chips__chip--krew ${activeKrew ? 'home-reach-chips__chip--active' : ''}`}
          aria-haspopup='menu'
          aria-expanded={menuOpen}
        >
          {activeKrew ? activeKrew.name : intl.formatMessage(messages.krew)}
          <ArrowDropDownIcon className='home-reach-chips__caret' />
        </button>

        {menuOpen && (
          <div
            className='home-reach-chips__menu'
            role='menu'
            aria-label={intl.formatMessage(messages.krewMenu)}
          >
            {!krewsLoaded && (
              <p className='home-reach-chips__menu-hint'>
                <FormattedMessage
                  id='home.reach.loading'
                  defaultMessage='Loading…'
                />
              </p>
            )}
            {krewsLoaded && krews.length === 0 && (
              <p className='home-reach-chips__menu-hint'>
                {intl.formatMessage(messages.noKrews)}
              </p>
            )}
            {krews.map((k) => (
              <KrewMenuItem
                key={k.id}
                krew={k}
                active={activeKrew?.id === k.id}
                onPick={handleKrewPick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
