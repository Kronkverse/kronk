// Tuning decides whether a korner reaches the feed (2026-10-11). The server
// drops a tuned-out korner's cards from the timeline reads
// (Kronk::TuneInGate); this does the same for posts that arrive live over
// streaming, which skip those reads.
//
// A streamed status is matched by its post_type, so only korners whose
// manifest declares `feed_projection.status_post_type` (Kommons) are caught
// here. Cards matched by association (Kalendar, Booth, …) leave on the next
// read.

import type { ApiKornerJSON } from 'mastodon/api_types/korners';

// Timelines that are the feed: Home (any reach, e.g. `home:mates`),
// Kommunity (`community`) and Kronkverse (`public`).
const isFeedTimeline = (timeline: string) =>
  timeline === 'home' ||
  timeline.startsWith('home:') ||
  timeline === 'community' ||
  timeline.startsWith('community:') ||
  timeline === 'public' ||
  timeline.startsWith('public:');

interface StreamedStatus {
  post_type?: string | null;
  reblog?: StreamedStatus | null;
}

/** True when a live update belongs to a korner this person tuned out of. */
export const isTunedOutLive = (
  timeline: string,
  status: StreamedStatus,
  korners: Record<string, ApiKornerJSON> | undefined,
) => {
  if (!korners || !isFeedTimeline(timeline)) return false;

  const postType = (status.reblog ?? status).post_type;
  if (!postType) return false;

  return Object.values(korners).some(
    (korner) =>
      korner.tuned_in === false &&
      korner.feed_projection?.status_post_type === postType,
  );
};
