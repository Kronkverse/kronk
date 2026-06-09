export interface BoothSet {
  id: string;
  title: string;
  description: string;
  artist_name: string;
  event_id: string | null;
  event_name: string | null;
  event_date: string | null;
  genres: string[];
  cover_offset_y: number | null;
  duration_seconds: number | null;
  play_count: number;
  audio_url: string | null;
  cover_url: string | null;
  published: boolean;
  is_owner?: boolean;
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
