import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useSpaceHeaderOverride } from 'mastodon/components/space_header_override';

// NudgesSpaceHeader — pushes the "Nudges" title into the Frame's
// SpaceHeaderRow center slot via `useSpaceHeaderOverride`, so nudges
// lands with the same top offset every korner-landing has and its
// first row / conversation header isn't pinned to viewport y=0.
//
// Same pattern as `SettingsSpaceHeader` — the `<h1>` carries
// `data-frame-header` so Stage's Frame-parasite dev warning
// (docs/korners/korner_standard.md § L11) treats it as the
// legitimate header owner.

interface Props {
  title: ReactNode;
}

export const NudgesSpaceHeader: React.FC<Props> = ({ title }) => {
  const node = useMemo(
    () => (
      <header className='space-header' data-frame-header=''>
        <h1 className='space-header__title'>{title}</h1>
      </header>
    ),
    [title],
  );
  useSpaceHeaderOverride(node);
  return null;
};
