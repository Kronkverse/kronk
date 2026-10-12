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
  play_count: number;
  audio_url: string | null;
  cover_url: string | null;
  published: boolean;
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
