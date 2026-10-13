import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachugotListings } from 'mastodon/api/wachuneed';
import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import { KornerPill } from 'mastodon/components/korner_pill';

import { WachuneedListings } from './wachuneed_view';

// Mine — the caller's own listings, across every state (live /
// reserved / closed). Reuses the shared WachuneedListings surface;
// only the loader differs. Above them, the way to your shop: open one,
// or see and edit the one you have.

const messages = defineMessages({
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
  view: { id: 'wachuneed.mine.view_shop', defaultMessage: 'See my shop' },
  edit: { id: 'wachuneed.shop.edit', defaultMessage: 'Edit shop' },
});

const MyShopBar: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  // undefined while asking; null when you have no shop.
  const [shop, setShop] = useState<ApiShopJSON | null | undefined>();

  useEffect(() => {
    let cancelled = false;

    apiGetMyWachuneedShop()
      .then((data) => {
        if (!cancelled) setShop(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setShop(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleEdit = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);
  const acct = shop?.account.acct;
  const handleView = useCallback(() => {
    if (acct) history.push(`/hub/wachuneed/shop/${acct}`);
  }, [history, acct]);

  if (shop === undefined) return null;

  return (
    <div className='wachuneed__section-action'>
      {shop ? (
        <>
          <KornerPill
            label={intl.formatMessage(messages.view)}
            onClick={handleView}
          />
          <KornerPill
            label={intl.formatMessage(messages.edit)}
            onClick={handleEdit}
          />
        </>
      ) : (
        <KornerPill
          label={intl.formatMessage(messages.open)}
          onClick={handleEdit}
        />
      )}
    </div>
  );
};

export const WachugotListings: React.FC = () => (
  <>
    <MyShopBar />
    <WachuneedListings loader={apiGetWachugotListings} scope='mine' />
  </>
);
