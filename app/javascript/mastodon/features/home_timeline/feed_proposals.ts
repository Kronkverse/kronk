// Kommons proposals are opt-in in the feed (2026-10-09). The server leaves
// them out of the Home and Kommunity timeline reads unless the viewer turned
// on "Show Kommons proposals in my feed" (Kronk::FeedProposals); this does
// the same for posts that arrive live over streaming, which the server
// can't filter per viewer on the shared public channel.

import { feedShowProposals } from 'mastodon/initial_state';

let showProposals = feedShowProposals;

/** Called by Feed settings when the toggle changes, so live updates follow. */
export const setFeedShowProposals = (value: boolean) => {
  showProposals = value;
};

// Timelines that are the feed: Home (any reach, e.g. `home:mates`) and
// Kommunity (the `community` local timeline).
const isFeedTimeline = (timeline: string) =>
  timeline === 'home' ||
  timeline.startsWith('home:') ||
  timeline === 'community' ||
  timeline.startsWith('community:');

interface StreamedStatus {
  post_type?: string | null;
  reblog?: StreamedStatus | null;
}

/** True when a live update should not be added to this timeline. */
export const isHiddenProposal = (timeline: string, status: StreamedStatus) =>
  !showProposals &&
  isFeedTimeline(timeline) &&
  (status.post_type === 'proposal' || status.reblog?.post_type === 'proposal');
