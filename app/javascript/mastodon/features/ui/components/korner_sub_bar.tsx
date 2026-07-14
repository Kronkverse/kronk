import { useMemo } from 'react';

import { Link, useLocation } from 'react-router-dom';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// Sub-bar surfaced when the router is inside a `/hub/<slug>` view.
// Shows a "back to Hub" link, the korner's glyph, and its name — a
// small breadcrumb that anchors the user in the framework's grammar
// without duplicating what ColumnHeader already shows for the leaf
// page (spec §4 chrome, Phase 12.3).

const SLUG_RE = /^\/hub\/([a-z0-9-]+)(?:\/|$)/;

export const KornerSubBar = () => {
  const location = useLocation();

  const slug = useMemo(() => {
    const m = SLUG_RE.exec(location.pathname);
    return m?.[1];
  }, [location.pathname]);

  const korner = useKorner(slug);
  const Icon = useKornerIcon(slug);

  // The bare Hub landing (/hub) already has its own hero — no need for
  // a breadcrumb pointing back to itself. Also hide on non-hub routes.
  if (!slug || slug === 'groups') return null;

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
    </div>
  );
};
