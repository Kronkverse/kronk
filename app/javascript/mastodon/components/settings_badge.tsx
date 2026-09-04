import { Link, useLocation } from 'react-router-dom';

import { useKorner } from 'mastodon/hooks/useKorner';

// SettingsBadge — the "← Back" pill that floats in the SpaceNav slot
// on every settings page. Renders the same visual shape as
// SpaceBadge — arrow + cog glyph + short label — so the two live in
// the same chrome slot with the same visual weight.
//
// Contextual back-target (Tal 2026-09-04): the pill routes back to
// the space the caller was on when they entered settings, not to a
// hardcoded "All settings" hub. If you're deep in Albutts and you
// tap the cog, the badge takes you back to Albutts.
//
// Path → back-target mapping:
//
//   /hub/<slug>/settings   → /hub/<slug>       (label: korner name)
//   /hub/settings          → /hub              (label: "Hub")
//   /home/settings         → /home             (label: "Feed")
//   /settings/<section>    → /settings         (label: "Settings")
//   fallback (unknown)     → /                 (label: "Back")
//
// The old "/settings hub" affordance moved to a big footer button
// (<AllSettingsFooter>) at the bottom of every settings page.
//
// Spec: docs/kronk_frame.md § SpaceNav (SpaceBadge pattern) +
// docs/korners/korner_standard.md § L12 Settings.

const KORNER_SETTINGS_RE = /^\/hub\/([a-z0-9-]+)\/settings/;

interface Target {
  href: string;
  label: string;
}

const resolveTarget = (
  pathname: string,
  kornerName: string | undefined,
  kornerSlug: string | undefined,
): Target => {
  if (kornerSlug) {
    return { href: `/hub/${kornerSlug}`, label: kornerName ?? kornerSlug };
  }
  if (pathname.startsWith('/hub/settings')) {
    return { href: '/hub', label: 'Hub' };
  }
  if (pathname.startsWith('/home/settings')) {
    return { href: '/home', label: 'Feed' };
  }
  if (pathname.startsWith('/settings/')) {
    // Personal settings sub-page — parent is the settings hub itself.
    return { href: '/settings', label: 'Settings' };
  }
  return { href: '/', label: 'Back' };
};

export const SettingsBadge: React.FC = () => {
  const { pathname } = useLocation();
  const kornerSlug = KORNER_SETTINGS_RE.exec(pathname)?.[1];
  const korner = useKorner(kornerSlug);
  const { href, label } = resolveTarget(pathname, korner?.name, kornerSlug);

  return (
    <Link to={href} className='space-badge' aria-label={`Back to ${label}`}>
      <svg
        className='space-badge__arrow'
        viewBox='0 0 16 16'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        aria-hidden='true'
      >
        <path
          d='M10 3.5 L5.5 8 L10 12.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
      <svg
        className='space-badge__glyph'
        viewBox='0 0 24 24'
        fill='currentColor'
        aria-hidden='true'
        style={{ width: '1.05rem', height: '1.05rem' }}
      >
        {/* Material Symbols "settings" glyph, inlined so this component
            stays dep-free (no @/material-icons import). */}
        <path d='M9.25 22l-.4-3.2c-.325-.125-.63-.276-.913-.45-.284-.174-.559-.361-.826-.563l-2.975 1.25-2.75-4.75 2.575-1.95c-.033-.183-.058-.363-.075-.538A5.878 5.878 0 015.85 12c0-.183.008-.363.024-.538.017-.174.042-.354.075-.537L3.375 8.975l2.75-4.75 2.975 1.25c.267-.2.542-.387.826-.562.283-.176.588-.325.913-.45L10.75 2h4.5l.4 3.2c.325.125.63.275.913.45.283.175.558.363.825.563l2.975-1.25 2.75 4.75-2.575 1.95c.033.183.058.363.075.538.017.174.025.354.025.537 0 .183-.008.363-.025.538-.017.174-.042.354-.075.537l2.575 1.95-2.75 4.75-2.95-1.25a7.24 7.24 0 01-.838.562c-.283.175-.588.325-.912.45l-.4 3.2h-4.5zM12 15.5c.967 0 1.792-.342 2.475-1.025A3.375 3.375 0 0015.5 12c0-.967-.342-1.792-1.025-2.475A3.375 3.375 0 0012 8.5c-.983 0-1.813.342-2.487 1.025A3.393 3.393 0 008.5 12c0 .967.337 1.792 1.013 2.475.674.683 1.504 1.025 2.487 1.025z' />
      </svg>
      <span className='space-badge__name'>{label}</span>
    </Link>
  );
};
