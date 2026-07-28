// Kommunity — the whole-graph orb view. A first-class Kronk korner at
// /hub/kommunity. Sits inside the shared KornerShell so
// AutoSpaceBadge, AutoSpaceHeader, and AutoSpaceViewPicker do the
// chrome (Standard L11) — this file only declares the default view
// and mounts the orb.

import { KornerShell } from 'mastodon/components/korner_shell';

import { KronkOrb } from './orb';

const OrbView = () => <KronkOrb />;

export const Kommunity = () => (
  <KornerShell
    slug='kommunity'
    label='Kommunity'
    className='kommunity'
    defaultView='orb'
    views={{ orb: OrbView }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export for each korner
export default Kommunity;
