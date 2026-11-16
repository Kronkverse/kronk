import { defineMessages, useIntl } from 'react-intl';

import { Redirect, useLocation } from 'react-router-dom';

import { KornerShell } from 'mastodon/components/korner_shell';

import { WachuneedBrands } from './brands_view';
import { WachuneedHome } from './home_view';
import { WachugotListings } from './wachugot_view';

// /hub/wachuneed — Wachuneed. Three views, all rendered through the
// shared KornerShell (Tal, 2026-11-16: one page for everything, Brands, and
// your own):
//
//   /hub/wachuneed        → home   (shops along the top, then everything
//                                   offered and wanted in one grid)
//   /hub/wachuneed/brands → brands (brands members back; ?show=proposed)
//   /hub/wachuneed/mine   → mine   (your shop, requests, your listings)
//
// The view keys agree with `views:` in config/korners/wachuneed.yaml;
// the rotator (manifest header.rotator) drives the h1 + tagline.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
});

// Sections that are now part of another page. The server 301s these on a
// full page load; this covers a link followed inside the app. Offered and
// Desired became the one page's pills, Shops its top row, and Requests
// part of Mine (2026-11-16); Wachumissing and Wachugot were Desired and
// Mine until 2026-10-12.
const HOME = '/hub/wachuneed';
const MINE = '/hub/wachuneed/mine';
const OLD_SECTIONS: Record<string, { pathname: string; search?: string }> = {
  '/hub/wachuneed/offered': { pathname: HOME, search: '?show=offered' },
  '/hub/wachuneed/desired': { pathname: HOME, search: '?show=wanted' },
  '/hub/wachuneed/wachumissing': { pathname: HOME, search: '?show=wanted' },
  '/hub/wachuneed/shops': { pathname: HOME },
  '/hub/wachuneed/requests': { pathname: MINE },
  '/hub/wachuneed/wachugot': { pathname: MINE },
};

const renderHome = () => <WachuneedHome />;

const renderBrands = () => <WachuneedBrands />;

const renderMine = () => <WachugotListings />;

const Wachuneed: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { pathname } = useLocation();

  const moved = OLD_SECTIONS[pathname.replace(/\/$/, '')];
  if (moved) return <Redirect to={moved} />;

  return (
    <KornerShell
      slug='wachuneed'
      label={intl.formatMessage(messages.title)}
      className='scrollable wachuneed'
      defaultView='home'
      views={{
        home: renderHome,
        brands: renderBrands,
        mine: renderMine,
      }}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default Wachuneed;
