import { useEffect, useState } from 'react';

import { apiRequestGet } from 'mastodon/api';

export interface OrbAccount {
  id: string;
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

// Empty shape returned on network failure so the sphere skeleton (dim
// empty sockets) still paints instead of the caller sitting on a
// loading state indefinitely. 150 sockets mirrors OrbController's
// SOCKET_COUNT.
const EMPTY_ORB: OrbData = {
  generated_at: new Date().toISOString(),
  socket_count: 150,
  provenance: 'client-empty',
  accounts: [],
  follows: [],
};

// Fetches the live Kommunity orb (top-N local accounts + real follow
// edges) from `GET /api/v1/kommunity/orb`. Returns `null` while the
// first fetch is in flight so the sphere doesn't flash a placeholder
// state before the live set arrives.
//
// No synthesised fallback: the previous 99-account fixture made a
// small real community look drowned in fake accounts (Tal 2026-08-28
// — "I'm seeing the full sphere of users, but we don't have that
// many users yet, what's going on?"). On network failure we now
// return an empty payload — the sphere still renders as 150 dim
// sockets via the empty-socket layer already drawn in orb.tsx, which
// is honest and reads as "room to grow".
//
// Fires once per mount; the server caches, and busts on User /
// Follow after_commit hooks — see OrbController.bust_cache!
export const useMatesOrb = (): OrbData | null => {
  const [data, setData] = useState<OrbData | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiRequestGet<OrbData>('v1/kommunity/orb')
      .then((live) => {
        if (cancelled) return;
        setData(live);
      })
      .catch(() => {
        if (cancelled) return;
        setData(EMPTY_ORB);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
};
