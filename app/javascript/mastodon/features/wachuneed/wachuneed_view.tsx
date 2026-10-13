import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import type { apiGetWachuneedListings } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';

// Shared listing surface for the three sections (Offered / Desired / Mine).
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
    defaultMessage: 'Nothing on offer yet',
  },
  emptyBody: {
    id: 'wachuneed.empty.body',
    defaultMessage:
      'Art, stuff and offerings from the community show up here. Be the first to list something.',
  },
  emptyMine: {
    id: 'wachugot.empty',
    defaultMessage: "You haven't listed anything yet",
  },
  emptyMineBody: {
    id: 'wachugot.empty.body',
    defaultMessage: 'What you offer and what you are looking for is kept here.',
  },
  emptyWanted: {
    id: 'wachumissing.empty',
    defaultMessage: 'Nobody is looking for anything yet',
  },
  emptyWantedBody: {
    id: 'wachumissing.empty.body',
    defaultMessage:
      'Need something? Say what you are after and the community can help.',
  },
  listSomething: {
    id: 'wachuneed.list_something',
    defaultMessage: 'List something',
  },
  postWanted: {
    id: 'wachuneed.post_wanted',
    defaultMessage: 'Post a wanted ad',
  },
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

interface Props {
  loader: typeof apiGetWachuneedListings;
  scope: 'offered' | 'desired' | 'mine';
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

  const [emptyTitle, emptyBody] =
    scope === 'mine'
      ? [messages.emptyMine, messages.emptyMineBody]
      : scope === 'desired'
        ? [messages.emptyWanted, messages.emptyWantedBody]
        : [messages.empty, messages.emptyBody];

  // Each section offers the one thing you can do about it: Desired posts
  // a wanted ad, the others list something. A location object, not a
  // string: this app's history.push drops a `?query` given as a string.
  const history = useHistory();
  const wantedSection = scope === 'desired';
  const handleNew = useCallback(() => {
    history.push({
      pathname: '/hub/wachuneed/new',
      search: wantedSection ? '?kind=wanted' : '',
    });
  }, [history, wantedSection]);
  const newLabel = intl.formatMessage(
    wantedSection ? messages.postWanted : messages.listSomething,
  );

  return (
    <>
      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}

      {!loading && listings.length === 0 && (
        <EmptyState
          title={intl.formatMessage(emptyTitle)}
          body={intl.formatMessage(emptyBody)}
          action={
            <KornerPill
              label={newLabel}
              variant='primary'
              onClick={handleNew}
            />
          }
        />
      )}

      {/* Wanted ads had no way in from their own section: the only door
          was the New listing form's first question. */}
      {!loading && wantedSection && listings.length > 0 && (
        <div className='wachuneed__section-action'>
          <KornerPill label={newLabel} onClick={handleNew} />
        </div>
      )}

      <SpaceGrid>
        {listings.map((listing) => {
          const wanted = listing.kind === 'wanted';
          const categoryLabel = labelForCategory(listing.category);
          // A wanted listing says so on its tile, which matters in
          // Mine where both kinds sit side by side.
          const tag = wanted
            ? intl.formatMessage(messages.wanted)
            : categoryLabel
              ? intl.formatMessage(categoryLabel)
              : null;
          return (
            <SpaceCard
              key={listing.id}
              // Tap navigates to the listing detail page. Without
              // this the card was rendering as an inert <div> — Tal
              // 2026-09-20 "the wachuneed space, i can't open an
              // offering".
              to={`/hub/wachuneed/listings/${listing.id}`}
              image={listing.photo_url}
              // Emoji matches the category, to hint at what the listing is
              // when it has no photo of its own.
              placeholder={PLACEHOLDER[listing.category] ?? '📦'}
              title={listing.title}
              meta={listing.price_display}
              tag={tag}
              tagKind={wanted ? 'wanted' : listing.category}
            />
          );
        })}
      </SpaceGrid>
    </>
  );
};
