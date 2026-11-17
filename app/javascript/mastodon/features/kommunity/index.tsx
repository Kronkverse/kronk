// Kommunity — three views: Kommunity (the first page: a sideways row of
// people to discover, then everyone you can see, A to Z), Mates (yours,
// most recent poster first) and the whole-graph Orb (Tal, 2026-11-17,
// Kommons "Kommunity Page"). A first-class Kronk korner at /hub/kommunity.
// Sits inside the shared KornerShell so AutoSpaceBadge, AutoSpaceHeader,
// and AutoSpaceViewPicker do the chrome (Standard L11) — this file only
// declares the views + mounts them.

import { Redirect, useLocation } from 'react-router-dom';

import { KornerShell } from 'mastodon/components/korner_shell';

import { KommunityMates } from './everyone';
import { KommunityHome } from './home';
import { KronkOrb } from './orb';

// Discover and Everyone were views of their own until they folded into
// the first page; their links land there (config/routes.rb 301s them too).
const OLD_VIEWS = ['/hub/kommunity/discover', '/hub/kommunity/everyone'];

const HomeView = () => <KommunityHome />;
const MatesView = () => <KommunityMates />;
const OrbView = () => <KronkOrb />;

export const Kommunity = () => {
  const { pathname } = useLocation();

  if (OLD_VIEWS.includes(pathname.replace(/\/$/, ''))) {
    return <Redirect to='/hub/kommunity' />;
  }

  return (
    <KornerShell
      slug='kommunity'
      label='Kommunity'
      className='kommunity'
      defaultView='kommunity'
      views={{
        kommunity: HomeView,
        mates: MatesView,
        orb: OrbView,
      }}
    />
  );
};

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export for each korner
export default Kommunity;
