import { useEffect, useState } from 'react';

import api from 'mastodon/api';

export interface TimelineMember {
  id: string;
  rank: number;
  handle: string;
  display_name: string;
  avatar: string; // static (non-animated) avatar URL
  joined_at: string; // ISO date (day-precision; time-of-day is ignored)
  inviter_id: string | null;
  connections: number;
  korners: string[];
  vouch_count: number;
}

export interface MateBond {
  member_a: string;
  member_b: string;
  mates_since: string; // ISO date
}

export interface MatesTimelineData {
  generated_at: string;
  provenance: string;
  anchor_date: string;
  members: TimelineMember[];
  mates: MateBond[];
}

export interface UseMatesTimelineResult {
  data: MatesTimelineData | null;
  loading: boolean;
  error: unknown;
}

// Live fetch of the Mates timeline for one subject. Subject defaults
// to the current signed-in account; pass a `subject` handle (bare
// `name`, `@name`, or `@name@domain`) to render another Kronker's
// view — clicking a tile in the timeline will re-run the hook with a
// new handle, and the layout rebuilds around that person.
//
// Endpoint: `GET /api/v1/mates/timeline?subject=<acct>` —
// see `app/controllers/api/v1/mates/timelines_controller.rb` for the
// full shape contract. Deferred fields from KRONK_KOMMUNITY.md
// (`korners`, `vouch_count`) come back as empty defaults today so the
// visual layout renders unchanged; they light up when the underlying
// subsystems ship.
export const useMatesTimeline = (subject?: string): UseMatesTimelineResult => {
  const [data, setData] = useState<MatesTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api()
      .get<MatesTimelineData>('/api/v1/mates/timeline', {
        params: subject ? { subject } : undefined,
      })
      .then((res) => {
        if (!cancelled) setData(res.data);
        return undefined;
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subject]);

  return { data, loading, error };
};
