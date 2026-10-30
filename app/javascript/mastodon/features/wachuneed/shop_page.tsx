import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiUpdateWachuneedListing } from 'mastodon/api/wachuneed';
import { apiGetWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { ComposeSelect } from 'mastodon/components/compose_fields';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';

import { ListingCard } from './listing_card';

// /hub/wachuneed/shop/:acct — one seller's shop front, on the standard
// detail shell (`<KornerDetail>`, docs/design.md, Detail pages): the covers
// of its newest items as the hero, the shop's name and line as title and
// subtitle, who and where as the facts line, Message the seller as the one
// action, then what the shop says of itself and its live offers, one row
// that scrolls sideways per Kollection the seller named, in their order;
// anything in none is the last row, "Everything else". A shop with no
// Kollections shows its items in the grid. Wanted ads are not part of a
// shop.
//
// The owner's way in to change the shop is Edit on the Ж menu, and + there
// adds an item (for everyone else it is New listing). On their own shop the
// owner also sees every Kollection, empty ones too, with an Add an item tile
// at the end of each row, Add a Kollection under the last, and Arrange,
// which puts each item's Kollection beside it to change.

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
  add: { id: 'wachuneed.shop_items.add', defaultMessage: 'Add an item' },
  edit: { id: 'wachuneed.shop.edit', defaultMessage: 'Edit shop' },
  message: {
    id: 'wachuneed.shop.message',
    defaultMessage: 'Message the seller',
  },
  count: {
    id: 'wachuneed.shops.count',
    defaultMessage: '{count, plural, one {# listing} other {# listings}}',
  },
  sections: { id: 'wachuneed.shop.sections', defaultMessage: 'Kollections' },
  addKollection: {
    id: 'wachuneed.shop.kollection_add',
    defaultMessage: 'Add a Kollection',
  },
  arrange: {
    id: 'wachuneed.shop.arrange',
    defaultMessage: 'Arrange Kollections',
  },
  arrangeDone: { id: 'wachuneed.shop.arrange_done', defaultMessage: 'Done' },
  arrangeHint: {
    id: 'wachuneed.shop.arrange_hint',
    defaultMessage: 'Choose the Kollection each item sits in.',
  },
  kollectionOf: {
    id: 'wachuneed.shop.kollection_of',
    defaultMessage: 'Kollection for {title}',
  },
  none: { id: 'wachuneed.shop.kollection_none', defaultMessage: 'None' },
  moveError: {
    id: 'wachuneed.shop.move_error',
    defaultMessage: "Couldn't move that item. Try again.",
  },
});

interface Shelf {
  key: string;
  name: string | null;
  listings: ApiListingJSON[];
}

// Kollections in the seller's order, each with its listings; then whatever
// is in none. Empty Kollections are left out, except for the owner, who
// fills them from here.
const shelve = (
  shop: ApiShopJSON,
  restName: string,
  isOwner: boolean,
): Shelf[] => {
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
  const filled = shelves.filter(
    (shelf) => isOwner || shelf.listings.length > 0,
  );

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
const ShelfPill: React.FC<{ shelf: Shelf }> = ({ shelf }) => {
  const handleClick = useCallback(() => {
    document
      .getElementById(shelfId(shelf))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [shelf]);

  return (
    <KornerPill
      label={`${shelf.name} (${shelf.listings.length})`}
      onClick={handleClick}
    />
  );
};

const ShopBody: React.FC<{ acct: string }> = ({ acct }) => {
  const intl = useIntl();
  const history = useHistory();
  const [shop, setShop] = useState<ApiShopJSON | null>(null);
  const [loading, setLoading] = useState(true);
  // The owner's Arrange: each item's Kollection beside it, to change.
  const [arranging, setArranging] = useState(false);
  const [moveError, setMoveError] = useState(false);

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

  const isOwner = !!me && shop?.account.id === me;
  const sellerId = shop?.account.id;

  const handleEdit = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEdit,
    isOwner,
  );

  const handleMessage = useCallback(() => {
    if (sellerId) history.push(`/nudges/with/${sellerId}`);
  }, [history, sellerId]);
  const handleAdd = useCallback(() => {
    history.push({ pathname: '/hub/wachuneed/my-shop', search: '?item=new' });
  }, [history]);

  // In your own shop, + adds to the shop.
  useRegisterPageAction(
    {
      key: 'post',
      label: intl.formatMessage(messages.add),
      icon: AddIcon,
      iconId: 'add',
    },
    handleAdd,
    isOwner,
  );

  const handleAddKollection = useCallback(() => {
    history.push({
      pathname: '/hub/wachuneed/my-shop',
      search: '?kollection=new',
    });
  }, [history]);
  const handleArrange = useCallback(() => {
    setArranging((on) => !on);
    setMoveError(false);
  }, []);

  // Moving an item is the listing's own edit (owner only on the server),
  // sending just the Kollection; the page follows without a reload.
  const handleMove = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const listingId = e.currentTarget.dataset.id;
      const sectionId = e.currentTarget.value || null;
      if (!listingId) return;
      setMoveError(false);
      apiUpdateWachuneedListing(listingId, {
        listing_shop_section_id: sectionId,
      })
        .then(() => {
          setShop((prev) =>
            prev
              ? {
                  ...prev,
                  listings: (prev.listings ?? []).map((l) =>
                    l.id === listingId
                      ? { ...l, shop_section_id: sectionId }
                      : l,
                  ),
                }
              : prev,
          );
          return undefined;
        })
        .catch(() => {
          setMoveError(true);
        });
    },
    [],
  );

  const restName = intl.formatMessage(messages.rest);
  const shelves = useMemo(
    () => (shop ? shelve(shop, restName, isOwner) : []),
    [shop, restName, isOwner],
  );

  if (loading) {
    return (
      <div className='stage-column'>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className='stage-column'>
        <EmptyState
          title={intl.formatMessage(messages.gone)}
          body={intl.formatMessage(messages.goneBody)}
          action={
            <Link to='/hub/wachuneed'>{intl.formatMessage(messages.back)}</Link>
          }
        />
      </div>
    );
  }

  const owner = shop.account.display_name || `@${shop.account.acct}`;
  const covers = shop.preview_photos ?? [];
  const count = (shop.listings ?? []).length;
  const kollections = shop.sections ?? [];
  // Rows once the seller has Kollections; until then, the grid.
  const layout = kollections.length > 0 ? 'row' : 'grid';

  return (
    <KornerDetail
      className='wachuneed-shop'
      // What is inside, across the top: the covers of the newest items.
      hero={
        covers.length > 0 ? (
          <div className='wachuneed-shop__covers' aria-hidden='true'>
            {covers.map((url) => (
              <img key={url} src={url} alt='' />
            ))}
          </div>
        ) : null
      }
      title={shop.name}
      subtitle={shop.description}
      meta={
        <KornerMeta
          className='wachuneed-shop__facts'
          items={[
            <Link key='owner' to={`/@${shop.account.acct}`}>
              {intl.formatMessage(messages.by, { name: owner })}
            </Link>,
            shop.based_in,
            count > 0 && intl.formatMessage(messages.count, { count }),
          ]}
        />
      }
      actions={
        // Whoever can see the shop can message the seller from it. The
        // owner arranges their items, once there are Kollections to
        // arrange them in.
        isOwner ? (
          kollections.length > 0 && count > 0 ? (
            <KornerActionBar align='center'>
              <KornerPill
                variant={arranging ? 'primary' : undefined}
                label={intl.formatMessage(
                  arranging ? messages.arrangeDone : messages.arrange,
                )}
                onClick={handleArrange}
              />
            </KornerActionBar>
          ) : null
        ) : shop.can_message ? (
          <KornerActionBar align='center'>
            <KornerPill
              variant='primary'
              label={intl.formatMessage(messages.message)}
              onClick={handleMessage}
            />
          </KornerActionBar>
        ) : null
      }
    >
      {shop.about ? (
        <p className='wachuneed-shop__about'>{shop.about}</p>
      ) : null}

      {(shop.payment ?? shop.handover) ? (
        <dl className='wachuneed-detail__terms'>
          {shop.payment ? (
            <>
              <dt>{intl.formatMessage(messages.payment)}</dt>
              <dd>{shop.payment}</dd>
            </>
          ) : null}
          {shop.handover ? (
            <>
              <dt>{intl.formatMessage(messages.handover)}</dt>
              <dd>{shop.handover}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {shelves.length > 1 ? (
        <nav aria-label={intl.formatMessage(messages.sections)}>
          <KornerActionBar align='center'>
            {shelves.map((shelf) => (
              <ShelfPill key={shelf.key} shelf={shelf} />
            ))}
          </KornerActionBar>
        </nav>
      ) : null}

      {shelves.length === 0 && (
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={isOwner ? intl.formatMessage(messages.emptyOwner) : undefined}
          action={
            isOwner ? (
              <KornerPill
                variant='primary'
                label={intl.formatMessage(messages.add)}
                onClick={handleAdd}
              />
            ) : undefined
          }
        />
      )}

      {arranging ? (
        <p className='wachuneed-shop__hint' role='status'>
          {intl.formatMessage(
            moveError ? messages.moveError : messages.arrangeHint,
          )}
        </p>
      ) : null}

      {shelves.map((shelf) => (
        <section
          key={shelf.key}
          id={shelfId(shelf)}
          className='wachuneed-shop__section'
        >
          {shelf.name ? (
            <h2 className='wachuneed-shop__section-name'>{shelf.name}</h2>
          ) : null}
          <SpaceGrid layout={layout}>
            {shelf.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
            {isOwner ? (
              <SpaceCard
                to='/hub/wachuneed/my-shop?item=new'
                placeholder={<AddIcon className='wachuneed-shop__add-icon' />}
                title={intl.formatMessage(messages.add)}
              />
            ) : null}
          </SpaceGrid>
          {arranging && shelf.listings.length > 0 ? (
            <ul className='wachuneed-shop__arrange'>
              {shelf.listings.map((listing) => (
                <li key={listing.id} className='wachuneed-shop__arrange-item'>
                  <span className='wachuneed-shop__arrange-title'>
                    {listing.title}
                  </span>
                  <ComposeSelect
                    data-id={listing.id}
                    value={
                      listing.shop_section_id &&
                      kollections.some((k) => k.id === listing.shop_section_id)
                        ? listing.shop_section_id
                        : ''
                    }
                    onChange={handleMove}
                    aria-label={intl.formatMessage(messages.kollectionOf, {
                      title: listing.title,
                    })}
                  >
                    <option value=''>
                      {intl.formatMessage(messages.none)}
                    </option>
                    {kollections.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </ComposeSelect>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {isOwner && shelves.length > 0 ? (
        <KornerActionBar align='center'>
          <KornerPill
            label={intl.formatMessage(messages.addKollection)}
            onClick={handleAddKollection}
          />
        </KornerActionBar>
      ) : null}
    </KornerDetail>
  );
};

const WachuneedShop: React.FC<{ multiColumn?: boolean }> = () => {
  const { acct } = useParams<{ acct: string }>();
  const intl = useIntl();

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <ShopBody acct={acct} />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default WachuneedShop;
