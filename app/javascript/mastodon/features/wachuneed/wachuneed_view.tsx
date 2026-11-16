import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachugotListings } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ListingCard } from './listing_card';

// Your own listings on Mine, both kinds and every state, in the shared
// `<SpaceGrid>`. (Offered and Desired drew the same grid until they became
// the one page, 2026-11-16.)

const messages = defineMessages({
  loading: {
    id: 'wachuneed.loading',
    defaultMessage: 'Loading listings…',
  },
  emptyMine: {
    id: 'wachugot.empty',
    defaultMessage: "You haven't listed anything yet",
  },
  emptyMineBody: {
    id: 'wachugot.empty.body',
    defaultMessage: 'What you offer and what you are looking for is kept here.',
  },
  listSomething: {
    id: 'wachuneed.list_something',
    defaultMessage: 'List something',
  },
});

export const MyListings: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [listings, setListings] = useState<ApiListingJSON[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiGetWachugotListings()
      .then((data) => {
        if (!cancelled) setListings(data);
        return undefined;
      })
      .catch(() => {
        // Leave the list empty on error; the page still renders.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = useCallback(() => {
    history.push('/hub/wachuneed/new');
  }, [history]);

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  if (listings.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.emptyMine)}
        body={intl.formatMessage(messages.emptyMineBody)}
        action={
          <KornerPill
            label={intl.formatMessage(messages.listSomething)}
            variant='primary'
            onClick={handleNew}
          />
        }
      />
    );
  }

  return (
    <SpaceGrid>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </SpaceGrid>
  );
};
