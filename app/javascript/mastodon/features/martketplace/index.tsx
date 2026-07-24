import { defineMessages, useIntl } from 'react-intl';

import { apiGetWachuneedListings } from 'mastodon/api/martketplace';
import { KornerShell } from 'mastodon/components/korner_shell';

import { WachugotListings } from './wachugot_view';
import { WachuneedListings } from './wachuneed_view';

// /hub/martketplace — mARTketplace landing. Two views, both rendered
// through the shared KornerShell:
//
//   /hub/martketplace          → wachuneed (browse others' live listings)
//   /hub/martketplace/wachugot → wachugot  (the caller's own listings)
//
// The view keys agree with `views:` in config/korners/martketplace.yaml;
// AutoSpaceViewPicker reads that list for the tab labels. Category
// filters (Art / Stuff / Offerings / All) live inside each view — the
// SpaceNav picker is the primary switch, category tabs are secondary.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'mARTketplace' },
});

const renderWachuneed = () => (
  <WachuneedListings loader={apiGetWachuneedListings} scope='wachuneed' />
);

const renderWachugot = () => <WachugotListings />;

const Martketplace: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <KornerShell
      slug='martketplace'
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
export default Martketplace;
