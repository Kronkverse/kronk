import { apiRequestGet, apiRequestPost } from 'mastodon/api';

import type { BoothLiveMoment, BoothLiveMomentKind } from './types';

// The crowd on screen in a live set (docs/spaces/booth.md): shoutouts,
// reactions, track requests and the host's Now playing.
//
// Kronk keeps them (GET/POST /api/v1/booth_lives/:id/moments) and draws
// them over the call for everyone watching (components/live_crowd.tsx).
// The host's page also sends each one into the call as a text message to
// everyone (Call.broadcast), so a script on the Jitsi server's page can
// draw it inside the call, which is what the recorder records. That
// message is a CrowdMessage as JSON; booth.md documents it for whoever
// writes that script, so change the two together, and the version with
// any change that isn't only a new `type`.

// The reactions a listener can send (BoothLiveMoment::REACTIONS). The
// message carries the key; whoever draws it chooses the words or icon.
export const REACTIONS = ['froth', 'applause', 'rewind'] as const;
export type Reaction = (typeof REACTIONS)[number];

export const CROWD_MESSAGE_VERSION = 1;

export interface CrowdMessage {
  // Always 1 for this shape. A script should ignore other versions.
  kronk: typeof CROWD_MESSAGE_VERSION;
  type: BoothLiveMomentKind;
  // The sender's display name (the host's, for a track).
  name: string;
  // A shoutout's or request's words, a reaction's key, or the track as
  // "Artist – Title" (or "Title").
  text: string;
  // Whole seconds since the set went live.
  at: number;
}

export const crowdMessage = (moment: BoothLiveMoment): CrowdMessage => ({
  kronk: CROWD_MESSAGE_VERSION,
  type: moment.kind,
  name: moment.account.display_name,
  text: moment.text,
  at: moment.at_seconds,
});

// The text that goes into the call.
export const crowdMessageText = (moment: BoothLiveMoment): string =>
  JSON.stringify(crowdMessage(moment));

// What's playing, again: the host's page sends it when recording starts,
// so the recording's screen has it from the first frame.
export const trackMessageText = (
  name: string,
  text: string,
  at: number,
): string => {
  const message: CrowdMessage = {
    kronk: CROWD_MESSAGE_VERSION,
    type: 'track',
    name,
    text,
    at,
  };
  return JSON.stringify(message);
};

// The moments after `sinceId`, oldest first; without it, the latest few.
export const fetchMoments = (
  liveId: string,
  sinceId: string | null,
): Promise<BoothLiveMoment[]> =>
  apiRequestGet<BoothLiveMoment[]>(
    `v1/booth_lives/${liveId}/moments`,
    sinceId ? { since_id: sinceId } : undefined,
  );

// `body` is the words, a reaction's key, or "Artist - Title" for a track.
export const postMoment = (
  liveId: string,
  kind: BoothLiveMomentKind,
  body: string,
): Promise<BoothLiveMoment> =>
  apiRequestPost<BoothLiveMoment>(`v1/booth_lives/${liveId}/moments`, {
    kind,
    body,
  });
