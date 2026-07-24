// Template korner index — the file that mounts at /hub/mykorner.
//
// The Kronk Frame provides three chrome slots for this route already:
//
//   • AutoSpaceBadge      — the space title, from manifest `name` + `icon.text_glyph`
//   • AutoSpaceIntro      — the tagline, from manifest `tagline`
//   • AutoSpaceViewPicker — the tab row, from manifest `views:`
//
// This file MUST NOT duplicate any of them. No <h1>, no role="tablist",
// no tagline literal. Standard L11 (docs/korners/korner_standard.md)
// and `bin/tootctl korners doctor` catch that drift.
//
// The current view is derived from the URL, not local state. The
// AutoSpaceViewPicker navigates by history.push; this component just
// reads useLocation() and renders the matching view.
//
//   /hub/mykorner        → default (the first entry in manifest views:)
//   /hub/mykorner/other  → other
//
// Read docs/kronk_frame.md before editing this pattern.

import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { DefaultView } from './default_view';
import { OtherView } from './other_view';

const VIEW_RE = /^\/hub\/mykorner\/(\w+)$/;

export const MyKorner: React.FC<{ multiColumn?: boolean }> = () => {
  const { pathname } = useLocation();
  const view = VIEW_RE.exec(pathname)?.[1] ?? 'default';

  return (
    <Stage label='MyKorner'>
      <div className='mykorner'>
        {view === 'other' ? <OtherView /> : <DefaultView />}
      </div>
    </Stage>
  );
};
