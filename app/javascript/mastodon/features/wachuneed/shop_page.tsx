import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiGetWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerShell } from 'mastodon/components/korner_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';

import { ListingCard } from './listing_card';

// /hub/wachuneed/shop/:acct — one seller's shop front: a banner of what is
// inside, whose it is and how to reach them, what the shop says of itself,
// then their live offers under the sections they named, in the order they
// chose; anything they left unplaced sits under "Everything else". Wanted
// ads are not part of a shop.

const messages = defineMessages({
  title: { id: 'wachuneed.title', defaultMessage: 'Wachuneed' },
  loading: { id: 'wachuneed.shop.loading', defaultMessage: 'Loading shop…' },
  gone: {
    id: 'wachuneed.shop.gone',
    defaultMessage: "This shop isn't here",
  },
  goneBody: {
    id: 'wachuneed.shop.gone.body',
    defaultMessage: 'It may have been closed, or never opened.',
  },
  back: { id: 'wachuneed.detail.back', defaultMessage: 'Back to Wachuneed' },
  by: { id: 'wachuneed.shop.by', defaultMessage: 'by {name}' },
  rest: { id: 'wachuneed.shop.rest', defaultMessage: 'Everything else' },
  byIn: { id: 'wachuneed.shop.by_in', defaultMessage: 'by {name}, {place}' },
  payment: { id: 'wachuneed.detail.payment', defaultMessage: 'How to pay' },
  handover: {
    id: 'wachuneed.detail.handover',
    defaultMessage: 'Pickup and postage',
  },
  empty: {
    id: 'wachuneed.shop.empty',
    defaultMessage: 'Nothing on offer right now',
  },
  emptyOwner: {
    id: 'wachuneed.shop.empty.owner',
    defaultMessage: 'Add an item and it shows here.',
  },
  edit: { id: 'wachuneed.shop.edit', defaultMessage: 'Edit shop' },
  manage: { id: 'wachuneed.shop.manage', defaultMessage: 'Manage shop' },
  add: { id: 'wachuneed.shop_items.add', defaultMessage: 'Add an item' },
  message: {
    id: 'wachuneed.shop.message',
    defaultMessage: 'Message the seller',
  },
  matesOnly: {
    id: 'wachuneed.shop.mates_only',
    defaultMessage: 'Only their Mates can message them.',
  },
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
  sections: { id: 'wachuneed.shop.sections', defaultMessage: 'Sections' },
});

interface Shelf {
  key: string;
  name: string | null;
  listings: ApiListingJSON[];
}

// Sections in the seller's order, each with its listings; then whatever
// has no section. Empty sections are left out for a visitor.
const shelve = (shop: ApiShopJSON, restName: string): Shelf[] => {
  const listings = shop.listings ?? [];
  const sections = shop.sections ?? [];
  const known = new Set(sections.map((section) => section.id));

  const shelves: Shelf[] = sections.map((section) => ({
    key: section.id,
    name: section.name,
    listings: listings.filter((l) => l.shop_section_id === section.id),
  }));
  const rest = listings.filter(
    (l) => !l.shop_section_id || !known.has(l.shop_section_id),
  );
  const filled = shelves.filter((shelf) => shelf.listings.length > 0);

  if (rest.length > 0) {
    // With no sections at all there is nothing for "else" to be else to.
    filled.push({
      key: 'rest',
      name: filled.length > 0 ? restName : null,
      listings: rest,
    });
  }

  return filled;
};

const shelfId = (shelf: Shelf) => `wachuneed-shelf-${shelf.key}`;

// A section's name as a jump to it. The page scrolls; the address stays.
const ShelfLink: React.FC<{ shelf: Shelf }> = ({ shelf }) => {
  const handleClick = useCallback(() => {
    document
      .getElementById(shelfId(shelf))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shelf]);

  return (
    <button
      type='button'
      className='wachuneed-shop__nav-link'
      onClick={handleClick}
    >
      {shelf.name}
      <span className='wachuneed-shop__nav-count'>{shelf.listings.length}</span>
    </button>
  );
};

const ShopBody: React.FC<{ acct: string }> = ({ acct }) => {
  const intl = useIntl();
  const history = useHistory();
  const [shop, setShop] = useState<ApiShopJSON | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShop(null);

    apiGetWachuneedShop(acct)
      .then((data) => {
        if (!cancelled) setShop(data);
        return undefined;
      })
      .catch(() => {
        // Left null: the page says the shop isn't here.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [acct]);

  const handleEdit = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);
  useRegisterPageAction(
    {
      key: 'edit-shop',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEdit,
    !!me && shop?.account.id === me,
  );

  const restName = intl.formatMessage(messages.rest);
  const shelves = useMemo(
    () => (shop ? shelve(shop, restName) : []),
    [shop, restName],
  );

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  if (!shop) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.gone)}
        body={intl.formatMessage(messages.goneBody)}
        action={
          <Link to='/hub/wachuneed'>{intl.formatMessage(messages.back)}</Link>
        }
      />
    );
  }

  const owner = shop.account.display_name || `@${shop.account.acct}`;
  const isOwner = !!me && shop.account.id === me;
  const banner = shop.preview_photos ?? [];
  const count = (shop.listings ?? []).length;

  return (
    <article className='wachuneed-shop'>
      {/* What is inside, across the top: the covers of the newest items.
          A shop with no photos yet keeps the band, so the picture below
          has something to stand on. */}
      <div
        className={`wachuneed-shop__banner wachuneed-shop__banner--${banner.length}`}
        aria-hidden='true'
      >
        {banner.map((url) => (
          <img key={url} src={url} alt='' />
        ))}
      </div>

      <header className='wachuneed-shop__header'>
        <img
          src={shop.picture_url ?? shop.account.avatar_static}
          alt=''
          className='wachuneed-shop__picture'
        />
        <div className='wachuneed-shop__identity'>
          <h1 className='wachuneed-shop__name'>{shop.name}</h1>
          <Link to={`/@${shop.account.acct}`} className='wachuneed-shop__owner'>
            {shop.based_in
              ? intl.formatMessage(messages.byIn, {
                  name: owner,
                  place: shop.based_in,
                })
              : intl.formatMessage(messages.by, { name: owner })}
          </Link>
        </div>
      </header>

      {shop.description ? (
        <p className='wachuneed-shop__description'>{shop.description}</p>
      ) : null}

      <div className='wachuneed-shop__actions'>
        {isOwner ? (
          <>
            <Link
              to='/hub/wachuneed/my-shop'
              className='wachuneed-shop__action'
            >
              {intl.formatMessage(messages.manage)}
            </Link>
            <Link
              to={{ pathname: '/hub/wachuneed/new', search: '?shop=1' }}
              className='wachuneed-shop__action wachuneed-shop__action--quiet'
            >
              {intl.formatMessage(messages.add)}
            </Link>
          </>
        ) : null}
        {!isOwner && shop.can_message ? (
          <Link
            to={`/nudges/with/${shop.account.id}`}
            className='wachuneed-shop__action'
          >
            {intl.formatMessage(messages.message)}
          </Link>
        ) : null}
        {!isOwner && shop.can_message === false ? (
          <span className='wachuneed-detail__mates-only'>
            {intl.formatMessage(messages.matesOnly)}
          </span>
        ) : null}
        {count > 0 ? (
          <span className='wachuneed-shop__count'>
            {intl.formatMessage(messages.count, { count })}
          </span>
        ) : null}
      </div>

      {(shop.about ?? shop.payment ?? shop.handover) ? (
        <section className='wachuneed-shop__about'>
          {shop.about ? (
            <p className='wachuneed-shop__about-text'>{shop.about}</p>
          ) : null}
          {(shop.payment ?? shop.handover) ? (
            <dl className='wachuneed-shop__terms'>
              {shop.payment ? (
                <div>
                  <dt>{intl.formatMessage(messages.payment)}</dt>
                  <dd>{shop.payment}</dd>
                </div>
              ) : null}
              {shop.handover ? (
                <div>
                  <dt>{intl.formatMessage(messages.handover)}</dt>
                  <dd>{shop.handover}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>
      ) : null}

      {shelves.length > 1 ? (
        <nav
          className='wachuneed-shop__nav'
          aria-label={intl.formatMessage(messages.sections)}
        >
          {shelves.map((shelf) => (
            <ShelfLink key={shelf.key} shelf={shelf} />
          ))}
        </nav>
      ) : null}

      {shelves.length === 0 && (
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={isOwner ? intl.formatMessage(messages.emptyOwner) : undefined}
        />
      )}

      {shelves.map((shelf) => (
        <section
          key={shelf.key}
          id={shelfId(shelf)}
          className='wachuneed-shop__section'
        >
          {shelf.name ? (
            <h2 className='wachuneed-shop__section-name'>
              {shelf.name}
              <span className='wachuneed-shop__section-count'>
                {shelf.listings.length}
              </span>
            </h2>
          ) : null}
          <SpaceGrid>
            {shelf.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </SpaceGrid>
        </section>
      ))}
    </article>
  );
};

const WachuneedShop: React.FC<{ multiColumn?: boolean }> = () => {
  const { acct } = useParams<{ acct: string }>();
  const intl = useIntl();

  const renderShop = useCallback(() => <ShopBody acct={acct} />, [acct]);
  const views = useMemo(() => ({ shop: renderShop }), [renderShop]);

  return (
    <KornerShell
      slug='wachuneed'
      label={intl.formatMessage(messages.title)}
      className='scrollable wachuneed wachuneed--shop'
      defaultView='shop'
      views={views}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedShop;
