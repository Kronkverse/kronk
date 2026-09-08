import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { apiGetWachuneedListings } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';

// Shared listing surface for both sub-views (Wachuneed / Wachugot).
// Which endpoint to hit is passed in as `loader` so both faces render
// the same grid — the only thing that changes is the scope of what
// came back from the API.
//
// Category filter tabs (All / Art / Stuff / Offerings) retired
// 2026-09-07 (Tal). The standard view is a plain listings grid; if
// category surfacing comes back it'll be through the manifest, not a
// hand-rolled tab strip.
//
// The grid itself moved out to `<SpaceGrid>` / `<SpaceCard>` — it turned out
// to be the shape any space wants for listing made things, so it is shared
// rather than Wachuneed's. What stays here is what is actually about
// listings: which endpoint, and what a category is called.

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

const PLACEHOLDER: Record<string, string> = {
  creation: '🎨',
  goods: '📦',
  service: '🤝',
};

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

      <SpaceGrid>
        {listings.map((listing) => {
          const categoryLabel = labelForCategory(listing.category);
          return (
            <SpaceCard
              key={listing.id}
              image={listing.photo_url}
              // Emoji matches the category, to hint at what the listing is
              // when it has no photo of its own.
              placeholder={PLACEHOLDER[listing.category] ?? '📦'}
              title={listing.title}
              meta={listing.price_display}
              tag={categoryLabel ? intl.formatMessage(categoryLabel) : null}
              tagKind={listing.category}
            />
          );
        })}
      </SpaceGrid>
    </>
  );
};
