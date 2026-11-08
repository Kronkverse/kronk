import { defineMessages, useIntl } from 'react-intl';

import { listingPath } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard } from 'mastodon/components/space_grid';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// One listing as a tile in a `<SpaceGrid>`: the three sections and a shop
// page all draw it the same way.

const messages = defineMessages({
  wanted: { id: 'wachuneed.kind.wanted', defaultMessage: 'Looking for' },
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
});

export const ListingCard: React.FC<{ listing: ApiListingJSON }> = ({
  listing,
}) => {
  const intl = useIntl();
  const glyph = useKornerIcon('wachuneed');
  const wanted = listing.kind === 'wanted';
  // A wanted listing says so on its tile, which matters in Mine where
  // both kinds sit side by side.
  const soldOut = !wanted && listing.availability === 'sold_out';
  const tag = wanted
    ? intl.formatMessage(messages.wanted)
    : soldOut
      ? intl.formatMessage(messages.soldOut)
      : null;

  return (
    <SpaceCard
      // Tap navigates to the listing detail page. Without this the card
      // was rendering as an inert <div> — Tal 2026-09-20 "the wachuneed
      // space, i can't open an offering".
      to={listingPath(listing)}
      image={listing.photo_url}
      // No photo: Wachuneed's own glyph (no emoji, site-wide).
      placeholder={<Icon id='korner-wachuneed' icon={glyph} />}
      title={listing.title}
      meta={listing.price_display}
      tag={tag}
      tagKind={wanted ? 'wanted' : undefined}
    />
  );
};
