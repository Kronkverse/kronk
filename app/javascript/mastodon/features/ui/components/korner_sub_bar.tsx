import { useMemo } from 'react';

import { Link, useLocation } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Sub-bar surfaced when the router is inside a `/hub/<slug>` view.
// Shows a "back to Hub" link, the korner's glyph, its name, and a
// settings gear pointing at `/hub/<slug>/settings` — the same gear
// affordance that shipping korner cards carry on the Hub grid, now
// consistent inside every korner too (Sweep 3 chrome consistency,
// per portal-me's 2026-07-12 handoff).

const SLUG_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;

export const KornerSubBar = () => {
  const location = useLocation();

  const slug = useMemo(() => {
    const m = SLUG_RE.exec(location.pathname);
    return m?.[1];
  }, [location.pathname]);

  const korner = useKorner(slug);
  const Icon = useKornerIcon(slug);

  // The bare Hub landing (/hub) already has its own hero — no need
  // for a breadcrumb pointing back to itself.
  if (!slug) return null;

  return (
    <div className='korner-sub-bar' aria-label='Korner breadcrumb'>
      <Link to='/hub' className='korner-sub-bar__back'>
        <ArrowBackIcon
          className='korner-sub-bar__back-icon'
          aria-hidden='true'
        />
        <span className='korner-sub-bar__back-label'>Hub</span>
      </Link>

      <span className='korner-sub-bar__divider' aria-hidden='true'>
        /
      </span>

      <span className='korner-sub-bar__crumb'>
        <span className='korner-sub-bar__glyph' aria-hidden='true'>
          <Icon />
        </span>
        <span className='korner-sub-bar__name'>{korner?.name ?? slug}</span>
      </span>

      <Link
        to={`/hub/${slug}/settings`}
        className='korner-sub-bar__settings'
        aria-label={`Settings for ${korner?.name ?? slug}`}
        title={`${korner?.name ?? slug} settings`}
      >
        <SettingsIcon
          className='korner-sub-bar__settings-icon'
          aria-hidden='true'
        />
      </Link>
    </div>
  );
};
