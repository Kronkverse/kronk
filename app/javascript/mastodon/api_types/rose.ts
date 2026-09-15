import type { ApiAccountJSON } from './accounts';

// A rose carries nothing but who sent it and when it arrived. There is
// no body, no read state and no count — see docs/spaces/rose.md.
export interface ApiRoseJSON {
  id: string;
  created_at: string;
  from_account: ApiAccountJSON;
  // Present on both listings; the one that matters depends on which
  // direction you asked for.
  to_account: ApiAccountJSON;
}
