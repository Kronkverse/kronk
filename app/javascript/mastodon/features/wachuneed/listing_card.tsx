import { defineMessages, useIntl } from 'react-intl';

import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { SpaceCard } from 'mastodon/components/space_grid';

// One listing as a tile in a `<SpaceGrid>`: the three sections and a shop
// page all draw it the same way.

const messages = defineMessages({
  wanted: { id: 'wachuneed.kind.wanted', defaultMessage: 'Looking for' },
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

export const ListingCard: React.FC<{ listing: ApiListingJSON }> = ({
  listing,
}) => {
  const intl = useIntl();
  const wanted = listing.kind === 'wanted';
  const categoryLabel = labelForCategory(listing.category);
  // A wanted listing says so on its tile, which matters in Mine where
  // both kinds sit side by side.
  const tag = wanted
    ? intl.formatMessage(messages.wanted)
    : categoryLabel
      ? intl.formatMessage(categoryLabel)
      : null;

  return (
    <SpaceCard
      // Tap navigates to the listing detail page. Without this the card
      // was rendering as an inert <div> — Tal 2026-09-20 "the wachuneed
      // space, i can't open an offering".
      to={`/hub/wachuneed/listings/${listing.id}`}
      image={listing.photo_url}
      // Emoji matches the category, to hint at what the listing is when
      // it has no photo of its own.
      placeholder={PLACEHOLDER[listing.category] ?? '📦'}
      title={listing.title}
      meta={listing.price_display}
      tag={tag}
      tagKind={wanted ? 'wanted' : listing.category}
    />
  );
};
