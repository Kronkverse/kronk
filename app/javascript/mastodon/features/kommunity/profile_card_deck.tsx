import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiGetKommunityLayer } from 'mastodon/api/kommunity';
import type { KommunityLayer } from 'mastodon/api/kommunity';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Icon } from 'mastodon/components/icon';
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
  prev: {
    id: 'kommunity.deck.prev',
    defaultMessage: 'Previous',
  },
  next: {
    id: 'kommunity.deck.next',
    defaultMessage: 'Next',
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
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Pre-fetch when the user swipes near the tail + track the visible
  // index for the desktop prev/next buttons. Uses scrollLeft /
  // clientWidth rather than IntersectionObserver so a snap-scroll's
  // fractional position (between two cards) still counts.
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth;
    if (cardWidth <= 0) return;
    const index = Math.round(el.scrollLeft / cardWidth);
    setCurrentIndex(index);
    if (index >= accounts.length - PREFETCH_CUSHION) loadMore();
  }, [accounts.length, loadMore]);

  // Advance / retreat the horizontal snap-scroller by one card width.
  // Desktop nav — the deck is a swipe surface on phone but has no
  // native affordance on a mouse-only viewport, hence the overlaid
  // chevron buttons + keyboard support (Tal 2026-09-08).
  const scrollToIndex = useCallback((next: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth;
    if (cardWidth <= 0) return;
    el.scrollTo({ left: next * cardWidth, behavior: 'smooth' });
  }, []);

  const handlePrev = useCallback(() => {
    scrollToIndex(Math.max(0, currentIndex - 1));
  }, [currentIndex, scrollToIndex]);

  const handleNext = useCallback(() => {
    scrollToIndex(Math.min(accounts.length - 1, currentIndex + 1));
  }, [accounts.length, currentIndex, scrollToIndex]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < accounts.length - 1;

  // Keyboard nav — the prev/next buttons are focusable via Tab and
  // activate via Enter/Space (standard button behaviour). Arrow keys
  // aren't wired up because the scroller div isn't a natural
  // interactive element; adding tabIndex + onKeyDown there trips the
  // jsx-a11y rules and adds a focus target that reads as an
  // enormous region to a screen reader. If arrow-key nav becomes
  // important, the buttons themselves can carry it on focus.

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
        <div className='kommunity-deck__stage'>
          <button
            type='button'
            className='kommunity-deck__nav kommunity-deck__nav--prev'
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label={intl.formatMessage(messages.prev)}
            title={intl.formatMessage(messages.prev)}
          >
            <Icon id='chevron_left' icon={ChevronLeftIcon} />
          </button>

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

          <button
            type='button'
            className='kommunity-deck__nav kommunity-deck__nav--next'
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label={intl.formatMessage(messages.next)}
            title={intl.formatMessage(messages.next)}
          >
            <Icon id='chevron_right' icon={ChevronRightIcon} />
          </button>
        </div>
      )}
    </section>
  );
};
