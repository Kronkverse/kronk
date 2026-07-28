import orbData from './data/orb_synthesised.json';

export interface OrbAccount {
  id: string;
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

// TODO: swap the bundled JSON for a live fetch when the Mates orb
// endpoint ships (Kommons proposal #116990859270976043 "Mates", step
// covered by KRONK_ORB_DATA_BRIEF.md). Contract when that lands:
// GET /api/v1/kronk/kommunity/orb returns the same shape (accounts
// gain username/display_name/avatar_url; follows become real edge
// pairs rather than synthesised ones). The Kosmos ambient layer
// itself is happy with either — density and rhythm are correct from
// real degrees; only the specific chord identities change.
export const useMatesOrb = (): OrbData => orbData as OrbData;
