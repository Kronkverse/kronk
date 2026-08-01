import { createAppSelector } from 'mastodon/store';

// Map of korner slug → unread badge count, including only korners that
// currently have unseen, feed-visible content (count > 0). Lets the Hub grid
// and side nav stamp per-korner badges — and any future aggregate nav badge
// sum them — without each consumer re-deriving the filter. Fed by
// ApiKornerJSON#unread_count (see lib/kronk/korner_seen.rb).
export const selectUnreadKornerCounts = createAppSelector(
  [(state) => state.korners],
  (korners) => {
    const counts: Record<string, number> = {};

    for (const korner of Object.values(korners)) {
      const count = korner.unread_count ?? 0;
      if (count > 0) counts[korner.slug] = count;
    }

    return counts;
  },
);
