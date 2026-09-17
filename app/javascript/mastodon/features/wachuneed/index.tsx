import { defineMessages, useIntl } from 'react-intl';

import { apiGetWachuneedListings } from 'mastodon/api/wachuneed';
import { KornerShell } from 'mastodon/components/korner_shell';

import { WachugotListings } from './wachugot_view';
import { WachuneedListings } from './wachuneed_view';

// /hub/wachuneed — Wachuneed landing. Two views, both rendered
// through the shared KornerShell:
//
//   /hub/wachuneed          → wachuneed (browse others' live listings)
//   /hub/wachuneed/wachugot → wachugot  (the caller's own listings)
//
// The view keys agree with `views:` in config/korners/wachuneed.yaml;
// the rotator (manifest header.rotator) drives the h1 + tagline. No
// per-view category filters — the standard view is a plain listings
// grid (2 wide phone / 4 wide desktop), category surfacing can come
// back once the manifest has real category counts.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
});

const renderWachuneed = () => (
  <WachuneedListings loader={apiGetWachuneedListings} scope='wachuneed' />
);

const renderWachugot = () => <WachugotListings />;

const Wachuneed: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <KornerShell
      slug='wachuneed'
      label={intl.formatMessage(messages.title)}
      className='scrollable wachuneed'
      defaultView='wachuneed'
      views={{
        wachuneed: renderWachuneed,
        wachugot: renderWachugot,
      }}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default Wachuneed;
