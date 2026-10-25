// Kommunity — the whole-graph orb view, the Discover drawer and the
// Everyone list. A
// first-class Kronk korner at /hub/kommunity. Sits inside the shared
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
// Everyone — the whole alphabetical directory, Mates included (Tal
// 2026-10-26). Discover is for meeting new people; this is for finding
// anyone you're allowed to.
const EveryoneView = () => <KommunityEveryone />;

export const Kommunity = () => (
  <KornerShell
    slug='kommunity'
    label='Kommunity'
    className='kommunity'
    defaultView='orb'
    views={{
      orb: OrbView,
      discover: DiscoverView,
      everyone: EveryoneView,
    }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export for each korner
export default Kommunity;
