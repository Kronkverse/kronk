import { useEffect, useState } from 'react';

import { apiRequestGet } from 'mastodon/api';

import orbData from './data/orb_synthesised.json';

export interface OrbAccount {
  id: string;
  // Live payload from `Api::V1::Kommunity::OrbController#show` includes
  // these — the bundled fallback JSON omits them (opaque `m1`, `m2` ids
  // with no display detail), so consumers treat them as optional. The
  // hover-tooltip is the only current reader; it prefers `username` and
  // falls back to `id`.
  username?: string;
  display_name?: string;
  avatar_url?: string;
  rank: number;
  connections: number;
  following: number;
  followers: number;
  interconnections: number;
}

export interface OrbData {
  generated_at: string;
  socket_count: number;
  provenance: string;
  accounts: OrbAccount[];
  follows: [string, string][];
}

// Bundled fallback — used while the live fetch is in flight and if it
// fails. Preserves the visual (density + rhythm are correct from real
// degrees); only the specific chord identities differ from live data.
const FALLBACK: OrbData = orbData as OrbData;

// Fetches the live Kommunity orb (top-N local accounts + real follow
// edges) from `GET /api/v1/kommunity/orb`. Falls back to the bundled
// synthesised JSON on network failure so the sphere always has
// something to draw. Fires once per mount; the server caches for 5
// minutes so repeated mounts across the app share one computation.
export const useMatesOrb = (): OrbData => {
  const [data, setData] = useState<OrbData>(FALLBACK);
  useEffect(() => {
    let cancelled = false;
    apiRequestGet<OrbData>('v1/kommunity/orb')
      .then((live) => {
        if (cancelled) return;
        // A well-formed but empty response (fresh instance, nobody in
        // the DB yet) would blank the sphere — keep the fallback
        // rhythm alive until there's at least one real member.
        if (live.accounts.length > 0) setData(live);
      })
      .catch(() => {
        // Silent — the bundled fallback is already on screen.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
};
