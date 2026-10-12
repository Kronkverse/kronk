import { defineMessages, useIntl } from 'react-intl';

import { Redirect, useLocation } from 'react-router-dom';

import {
  apiGetWachumissingListings,
  apiGetWachuneedListings,
} from 'mastodon/api/wachuneed';
import { KornerShell } from 'mastodon/components/korner_shell';

import { WachugotListings } from './wachugot_view';
import { WachuneedListings } from './wachuneed_view';

// /hub/wachuneed — Wachuneed landing. Three views, all rendered
// through the shared KornerShell:
//
//   /hub/wachuneed         → offered (live listings on offer)
//   /hub/wachuneed/desired → desired (what people are looking for)
//   /hub/wachuneed/mine    → mine    (the caller's own listings)
//
// The view keys agree with `views:` in config/korners/wachuneed.yaml;
// the rotator (manifest header.rotator) drives the h1 + tagline. No
// per-view category filters — the standard view is a plain listings
// grid (2 wide phone / 4 wide desktop), category surfacing can come
// back once the manifest has real category counts.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
});

// The sections' names until 2026-10-12. The server 301s these on a full
// page load; this covers a link followed inside the app.
const OLD_SECTIONS: Record<string, string> = {
  '/hub/wachuneed/wachumissing': '/hub/wachuneed/desired',
  '/hub/wachuneed/wachugot': '/hub/wachuneed/mine',
};

const renderOffered = () => (
  <WachuneedListings loader={apiGetWachuneedListings} scope='offered' />
);

const renderDesired = () => (
  <WachuneedListings loader={apiGetWachumissingListings} scope='desired' />
);

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
      defaultView='offered'
      views={{
        offered: renderOffered,
        desired: renderDesired,
        mine: renderMine,
      }}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default Wachuneed;
