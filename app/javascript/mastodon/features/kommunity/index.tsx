// Kommunity — the Discover drawer (landing), the Everyone list and the
// whole-graph Orb, in that order (Tal's Kommons proposal "Landing Page",
// #117483791865274639). A first-class Kronk korner at /hub/kommunity. Sits inside the shared
// KornerShell so AutoSpaceBadge, AutoSpaceHeader, and
// AutoSpaceViewPicker do the chrome (Standard L11) — this file only
// declares the views + mounts them.

import { KornerShell } from 'mastodon/components/korner_shell';

import { KommunityDrawer } from './drawer';
import { KommunityEveryone } from './everyone';
import { KronkOrb } from './orb';

const OrbView = () => <KronkOrb />;
// The Discover face now hosts the three-layer drawer (Kronkers /
// Orbit / Krews). The old flat row list was replaced (Tal
// 2026-08-28 — "these kronkers should be split into different
// lists"). Rotator key stays `discover` so the manifest + saved
// links keep working.
const DiscoverView = () => <KommunityDrawer />;
// Everyone — the whole alphabetical directory of people who chose to be
// visible to you. Discover is for meeting new people; this is the list.
const EveryoneView = () => <KommunityEveryone />;

export const Kommunity = () => (
  <KornerShell
    slug='kommunity'
    label='Kommunity'
    className='kommunity'
    defaultView='discover'
    views={{
      discover: DiscoverView,
      everyone: EveryoneView,
      orb: OrbView,
    }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export for each korner
export default Kommunity;
