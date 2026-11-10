import { apiRequestGet, apiRequestPost } from 'mastodon/api';

// A space's own Kuddle (docs/spaces/huddle.md, A space's own Kuddle): one
// each for a Krew, a projekt and a Komponent, for its members.

export interface ApiKuddleSpaceJSON {
  kind: 'krew' | 'freethedream';
  id: string;
  name: string;
  slug?: string;
  top_id?: string;
}

export interface ApiSpaceKuddleJSON {
  id: string;
  name: string;
  occupancy: number;
  last_active_at: string | null;
  space?: ApiKuddleSpaceJSON;
}

// A Krew's Kuddles: its own, then its projekts' and Komponents'.
export const apiKrewKuddles = (krewId: string) =>
  apiRequestGet<ApiSpaceKuddleJSON[]>('v1/huddle/spaces', { krew_id: krewId });

// The space's own Kuddle, made the first time (Konnect → Kuddle).
export const apiSpaceKuddle = (
  space: { krew_id: string } | { project_id: string },
) => apiRequestPost<ApiSpaceKuddleJSON>('v1/huddle/spaces', space);
