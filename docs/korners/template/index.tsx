// Template korner index — the file that mounts at /hub/mykorner.
//
// The Kronk Frame provides three chrome slots for this route:
//
//   • AutoSpaceBadge      — the space title, from manifest `name`
//   • AutoSpaceHeader     — the in-content title (<h1>{name}</h1>) + tagline
//   • AutoSpaceViewPicker — the tab row, from manifest `views:`
//
// KornerShell completes the deal: it owns the <Stage> wrapper and the
// URL-to-view routing. A korner index MUST NOT render its own <h1>,
// role="tablist", or tagline literal — the Frame renders all three
// already. Standard L11 (docs/korners/korner_standard.md) and
// `bin/tootctl korners doctor` catch that drift, and the shell nudges
// you into the right shape by construction.
//
// The `views` keys below MUST agree with `views:` in the manifest —
// AutoSpaceViewPicker reads that list for the tab labels; KornerShell
// reads it for the URL routing. One source of truth, two consumers.
//
//   /hub/mykorner        → default (the first entry in manifest views:)
//   /hub/mykorner/other  → other

import { KornerShell } from 'mastodon/components/korner_shell';

import { DefaultView } from './default_view';
import { OtherView } from './other_view';

export const MyKorner: React.FC<{ multiColumn?: boolean }> = () => (
  <KornerShell
    slug='mykorner'
    label='MyKorner'
    className='mykorner'
    defaultView='default'
    views={{
      default: () => <DefaultView />,
      other: () => <OtherView />,
    }}
  />
);
