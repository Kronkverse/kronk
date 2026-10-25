export interface BoothTrack {
  start_seconds: number | null;
  artist: string | null;
  title: string;
}

export interface BoothArtistAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}

// What a set is (`BoothSet::KINDS`).
export type BoothKind =
  | 'mix'
  | 'live_recording'
  | 'track'
  | 'podcast'
  | 'spoken_word';

// Someone who made a set. The uploader is always first and always verified.
// After them come the people they credited: a tagged Kronk account, which
// is unverified until that person confirms it, or a plain name for someone
// who is not on Kronk (`account: null`).
export interface BoothCredit {
  account: BoothArtistAccount | null;
  name: string | null;
  verified: boolean;
  uploader: boolean;
}

export interface BoothSet {
  id: string;
  title: string;
  description: string;
  // The credit line: the uploader and whoever they credited, as one string.
  artist_name: string;
  artists: BoothCredit[];
  event_name: string | null;
  event_date: string | null;
  genres: string[];
  cover_offset_y: number | null;
  duration_seconds: number | null;
  // Only for the set's owner (or a steward): plays are for the artist,
  // not a public chart.
  play_count?: number;
  audio_url: string | null;
  cover_url: string | null;
  published: boolean;
  kind: BoothKind;
  // Whether you kept it (My sets → Saved). Signed-in only.
  saved?: boolean;
  tracklist?: BoothTrack[];
  tracklist_text?: string;
  is_owner?: boolean;
  can_moderate?: boolean;
  account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    url: string;
  };
  created_at: string;
  updated_at: string;
}

// A live set (docs/spaces/booth.md, Live sets). `room_key` is the Jitsi
// room on Huddle's server.
export interface BoothLive {
  id: string;
  title: string;
  description: string;
  genres: string[];
  state: 'scheduled' | 'live' | 'ended';
  room_key: string;
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  is_owner: boolean;
  // Whether you asked for a Nudge when it starts.
  reminded: boolean;
  account: {
    id: string;
    acct: string;
    username: string;
    display_name: string;
    avatar: string;
  };
}

// A listener's note on a set, optionally pinned to a moment in it.
export interface BoothShoutout {
  id: string;
  body: string;
  at_seconds: number | null;
  created_at: string;
  can_remove: boolean;
  account: {
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
  };
}
