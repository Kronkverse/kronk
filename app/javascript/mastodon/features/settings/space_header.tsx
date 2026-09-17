import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useSpaceHeaderOverride } from 'mastodon/components/space_header_override';

// SettingsSpaceHeader — every settings page's title, pushed into the
// Frame's SpaceHeaderRow center slot via `useSpaceHeaderOverride`
// (docs/kronk_frame.md § SpaceHeader override).
//
// The previous shape rendered `<header class='space-header'>` inside
// the page body, one row BELOW the Frame's SpaceHeaderRow. On any
// settings sub-route the Frame's row is populated on the left (by
// `AutoSettingsBadge`), so its min-height (4.5rem) kicks in — the
// in-body title then sat visibly below that reserved band, ~50–80px
// down from where a korner-landing title sits.
//
// By pushing the header into the Frame's slot the settings title
// lands at the same vertical position as every korner landing.
// Nothing renders in the page body — the return value is `null`.
//
// Rendered `<h1>` uses the shared `.space-header` classes + the
// `data-frame-header` attribute so Stage's dev-only "Frame-parasite"
// warning (docs/korners/korner_standard.md § L11) excludes it.

interface Props {
  title: ReactNode;
  tagline?: ReactNode;
}

export const SettingsSpaceHeader: React.FC<Props> = ({ title, tagline }) => {
  // Memoise the injected node so `useSpaceHeaderOverride`'s effect
  // doesn't re-fire (and re-set the context) on every render — same
  // pattern the Art barrel override uses.
  const node = useMemo(
    () => (
      <header className='space-header' data-frame-header=''>
        <h1 className='space-header__title'>{title}</h1>
        {tagline !== undefined && tagline !== null && tagline !== '' && (
          <p className='space-header__tagline'>{tagline}</p>
        )}
      </header>
    ),
    [title, tagline],
  );
  useSpaceHeaderOverride(node);
  return null;
};
