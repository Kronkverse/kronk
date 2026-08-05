// Kommunity — the whole-graph orb view + the Discover list. A
// first-class Kronk korner at /hub/kommunity. Sits inside the shared
// KornerShell so AutoSpaceBadge, AutoSpaceHeader, and
// AutoSpaceViewPicker do the chrome (Standard L11) — this file only
// declares the views + mounts them.

import { KornerShell } from 'mastodon/components/korner_shell';

import { KommunityDiscover } from './discover';
import { KronkOrb } from './orb';

const OrbView = () => <KronkOrb />;
const DiscoverView = () => <KommunityDiscover />;

export const Kommunity = () => (
  <KornerShell
    slug='kommunity'
    label='Kommunity'
    className='kommunity'
    defaultView='orb'
    views={{ orb: OrbView, discover: DiscoverView }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export for each korner
export default Kommunity;
