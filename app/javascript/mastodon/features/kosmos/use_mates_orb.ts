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

// Bundled fallback — used only if the live fetch fails. Preserves the
// visual (density + rhythm are correct from real degrees); only the
// specific chord identities differ from live data.
const FALLBACK: OrbData = orbData as OrbData;

// Fetches the live Kommunity orb (top-N local accounts + real follow
// edges) from `GET /api/v1/kommunity/orb`. Returns `null` while the
// first fetch is in flight so the sphere doesn't paint the bundled
// 150-node fallback for a frame before swapping to the (usually much
// smaller) live set — Tal 2026-08-11: "when the page first loads, it
// shows a glimpse of the full orb". Falls back to the bundled JSON
// on network failure so the sphere always eventually renders.
// Fires once per mount; the server caches, and busts on User /
// Follow after_commit hooks — see OrbController.bust_cache!
export const useMatesOrb = (): OrbData | null => {
  const [data, setData] = useState<OrbData | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequestGet<OrbData>('v1/kommunity/orb')
      .then((live) => {
        if (cancelled) return;
        // A well-formed but empty response (fresh instance, nobody in
        // the DB yet) would blank the sphere — fall back to the
        // bundled rhythm so there's always something to draw.
        setData(live.accounts.length > 0 ? live : FALLBACK);
      })
      .catch(() => {
        if (cancelled) return;
        setData(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
};
