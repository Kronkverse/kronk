import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { apiGetWachuneedListings } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';

// Shared listing surface for both sub-views (Wachuneed / Wachugot).
// Which endpoint to hit is passed in as `loader` so both faces render
// the same grid — the only thing that changes is the scope of what
// came back from the API.
//
// Category filter tabs (All / Art / Stuff / Offerings) retired
// 2026-09-07 (Tal). The standard view is a plain listings grid; if
// category surfacing comes back it'll be through the manifest, not a
// hand-rolled tab strip.

const messages = defineMessages({
  loading: {
    id: 'wachuneed.loading',
    defaultMessage: 'Loading listings…',
  },
  empty: {
    id: 'wachuneed.empty',
    defaultMessage: 'No live listings yet.',
  },
  emptyMine: {
    id: 'wachugot.empty',
    defaultMessage: "You haven't listed anything yet.",
  },
  categoryArt: { id: 'wachuneed.category.art', defaultMessage: 'Art' },
  categoryStuff: { id: 'wachuneed.category.stuff', defaultMessage: 'Stuff' },
  categoryOfferings: {
    id: 'wachuneed.category.offerings',
    defaultMessage: 'Offerings',
  },
});

// Category → user-facing label. Server-side values stay as `creation`
// / `goods` / `service`. Rendered on each tile as a small chip.
const CATEGORY_LABEL = {
  creation: messages.categoryArt,
  goods: messages.categoryStuff,
  service: messages.categoryOfferings,
} as const;

const labelForCategory = (category: string) =>
  category in CATEGORY_LABEL
    ? CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL]
    : null;

interface Props {
  loader: typeof apiGetWachuneedListings;
  scope: 'wachuneed' | 'wachugot';
}

export const WachuneedListings: React.FC<Props> = ({ loader, scope }) => {
  const intl = useIntl();
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await loader();
        if (!cancelled) setListings(data);
      } catch {
        // Leave the list empty on error; the page still renders.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [loader]);

  const emptyMessage =
    scope === 'wachugot' ? messages.emptyMine : messages.empty;

  return (
    <>
      {loading && (
        <p className='wachuneed__status'>
          {intl.formatMessage(messages.loading)}
        </p>
      )}

      {!loading && listings.length === 0 && (
        <p className='wachuneed__status'>{intl.formatMessage(emptyMessage)}</p>
      )}

      <ul className='wachuneed__grid'>
        {listings.map((listing) => {
          const categoryLabel = labelForCategory(listing.category);
          return (
            <li key={listing.id} className='wachuneed__tile'>
              {listing.photo_url ? (
                <img
                  src={listing.photo_url}
                  alt=''
                  className='wachuneed__tile-photo'
                />
              ) : (
                // Photo-less tile keeps a square placeholder so every
                // tile in the grid has the same header height. Emoji
                // matches the category to hint at what the listing is.
                <div
                  className='wachuneed__tile-photo wachuneed__tile-photo--placeholder'
                  aria-hidden
                >
                  {listing.category === 'creation'
                    ? '🎨'
                    : listing.category === 'goods'
                      ? '📦'
                      : '🤝'}
                </div>
              )}
              <div className='wachuneed__tile-body'>
                <div className='wachuneed__tile-title'>{listing.title}</div>
                {listing.price_display && (
                  <div className='wachuneed__tile-price'>
                    {listing.price_display}
                  </div>
                )}
                {categoryLabel && (
                  <span
                    className={`wachuneed__tile-category wachuneed__tile-category--${listing.category}`}
                  >
                    {intl.formatMessage(categoryLabel)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};
