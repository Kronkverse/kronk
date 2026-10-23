import api from 'mastodon/api';

import type { BoothLive } from './types';

// "Remind me" on a scheduled live set: a Nudge when the host goes live.
// Returns the set as the server now has it.
export const toggleRemind = (live: BoothLive): Promise<BoothLive> =>
  (live.reminded
    ? api().delete<BoothLive>(`/api/v1/booth_lives/${live.id}/remind`)
    : api().post<BoothLive>(`/api/v1/booth_lives/${live.id}/remind`)
  ).then((res) => res.data);
