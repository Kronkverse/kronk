import api from 'mastodon/api';

import type { BoothSet } from './types';

// Keep a set in My sets → Saved, or let it go. Returns the set as the
// server now has it.
export const toggleSave = (set: BoothSet): Promise<BoothSet> =>
  (set.saved
    ? api().delete<BoothSet>(`/api/v1/booth_sets/${set.id}/save`)
    : api().post<BoothSet>(`/api/v1/booth_sets/${set.id}/save`)
  ).then((res) => res.data);
