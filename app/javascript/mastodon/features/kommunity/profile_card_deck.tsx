import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiGetKommunityLayer } from 'mastodon/api/kommunity';
import type { KommunityLayer } from 'mastodon/api/kommunity';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ProfileCard } from 'mastodon/features/profile_peek/profile_card';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

// Kommunity discover-drawer deck. One layer = one deck. Renders a
// small title, then a horizontal scroll-snap of ProfileCards (one
// card per screen). Loads its own page from the layer endpoint and
// paginates on demand as the user swipes toward the end.
//
// Vertical scroll (between layers) is owned by the parent drawer;
// this component only handles the horizontal swipe within a layer.

const PAGE_SIZE = 40;
// When the user swipes to within this many cards of the tail, we
// kick off the next page fetch. Bigger cushion = smoother; smaller =
// less pre-fetch waste.
const PREFETCH_CUSHION = 3;

const messages = defineMessages({
  emptyKronkers: {
    id: 'kommunity.deck.empty.kronkers',
    defaultMessage: 'No one new to find right now.',
  },
  emptyOrbit: {
    id: 'kommunity.deck.empty.orbit',
    defaultMessage:
      'Your Orbit is quiet — your mates haven’t added anyone else here yet.',
  },
  emptyKrews: {
    id: 'kommunity.deck.empty.krews',
    defaultMessage:
      'No krew members to show — join or seed a krew and they’ll surface here.',
  },
  error: {
    id: 'kommunity.deck.error',
    defaultMessage: 'Could not load this layer.',
  },
});

interface Props {
  layer: KommunityLayer;
  title: string;
}

export const ProfileCardDeck: React.FC<Props> = ({ layer, title }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [accounts, setAccounts] = useState<ApiAccountJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setHasMore(true);
    apiGetKommunityLayer(layer, null, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        // Hydrate accounts slice so the card's Mate button reads
        // its state from the store rather than refetching per row.
        dispatch(importFetchedAccounts(data));
        setAccounts(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layer, dispatch]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const last = accounts.at(-1);
    if (!last) return;
    setLoadingMore(true);
    apiGetKommunityLayer(layer, last.id, PAGE_SIZE)
      .then((data) => {
        dispatch(importFetchedAccounts(data));
        setAccounts((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {
        // Preserve what we already have; swipe forward retries.
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [accounts, dispatch, hasMore, layer, loadingMore]);

  // Pre-fetch when the user swipes near the tail. Uses scrollLeft /
  // clientWidth rather than IntersectionObserver so a snap-scroll's
  // fractional position (between two cards) still counts.
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth;
    if (cardWidth <= 0) return;
    const currentIndex = Math.round(el.scrollLeft / cardWidth);
    if (currentIndex >= accounts.length - PREFETCH_CUSHION) loadMore();
  }, [accounts.length, loadMore]);

  const emptyMessage =
    layer === 'kronkers'
      ? messages.emptyKronkers
      : layer === 'orbit'
        ? messages.emptyOrbit
        : messages.emptyKrews;

  return (
    <section className='kommunity-deck' aria-label={title} data-layer={layer}>
      <h3 className='kommunity-deck__title'>{title}</h3>

      {loading ? (
        <div className='kommunity-deck__state'>
          <LoadingIndicator />
        </div>
      ) : error ? (
        <div className='kommunity-deck__state kommunity-deck__state--error'>
          {intl.formatMessage(messages.error)}
        </div>
      ) : accounts.length === 0 ? (
        <div className='kommunity-deck__state'>
          {intl.formatMessage(emptyMessage)}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className='kommunity-deck__scroller'
          onScroll={handleScroll}
        >
          {accounts.map((accountJson) => {
            const account = createAccountFromServerJSON(accountJson);
            return (
              <div key={account.id} className='kommunity-deck__slide'>
                <ProfileCard account={account} />
              </div>
            );
          })}
          {loadingMore && (
            <div className='kommunity-deck__slide kommunity-deck__slide--loading'>
              <LoadingIndicator />
            </div>
          )}
        </div>
      )}
    </section>
  );
};
