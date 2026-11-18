import { defineMessages, useIntl } from 'react-intl';

import { listingPath } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard } from 'mastodon/components/space_grid';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { me } from 'mastodon/initial_state';

import { useListingPrice } from './listing_price';

// One listing as a tile in a `<SpaceGrid>`: the three sections and a shop
// page all draw it the same way.

const messages = defineMessages({
  offered: { id: 'wachuneed.card.offered', defaultMessage: 'Offered' },
  wanted: { id: 'wachuneed.card.wanted', defaultMessage: 'Wanted' },
  mine: { id: 'wachuneed.card.mine', defaultMessage: 'Mine' },
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
});

// Every tile says what kind of listing it is (Tal, 2026-11-16): Offered or
// Wanted, Sold out when nothing is left, and Mine on your own, which
// matters most in the one page's mixed grid. Mine (the section) is all
// yours, so it passes `markMine={false}` and its tiles keep their kind.
export const ListingCard: React.FC<{
  listing: ApiListingJSON;
  markMine?: boolean;
}> = ({ listing, markMine = true }) => {
  const intl = useIntl();
  const glyph = useKornerIcon('wachuneed');
  const price = useListingPrice(listing);
  const wanted = listing.kind === 'wanted';
  const mine = markMine && !!me && listing.account_id === me;
  const soldOut = !wanted && listing.availability === 'sold_out';
  const [tag, tagKind] = mine
    ? [messages.mine, 'mine']
    : wanted
      ? [messages.wanted, 'wanted']
      : soldOut
        ? [messages.soldOut, 'sold-out']
        : [messages.offered, 'offered'];

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
      meta={price}
      tag={intl.formatMessage(tag)}
      tagKind={tagKind}
    />
  );
};
