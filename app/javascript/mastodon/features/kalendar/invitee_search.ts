import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

// Who can be invited to an event (docs/spaces/kalendar.md, Invitations).
// An event for a Krew alone is asked of that Krew's members only
// (decisions.md, 2026-11-18), so the search looks in its Krews; any other
// event searches all of Kronk. Never the host.

export interface InviteeHit {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  acct: string;
}

const LIMIT = 6;

export const searchInvitees = async (
  query: string,
  krewIds: string[] | null,
): Promise<InviteeHit[]> => {
  const q = query.trim();
  if (!krewIds) {
    const res = await api().get<InviteeHit[]>('/api/v1/accounts/search', {
      params: { q, limit: LIMIT, resolve: false },
    });
    return res.data;
  }

  const lists = await Promise.all(
    krewIds.map((id) =>
      api()
        .get<InviteeHit[]>(`/api/v1/krews/${id}/members`, { params: { q } })
        .then((res) => res.data),
    ),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((account) => {
      if (account.id === me || seen.has(account.id)) return false;
      seen.add(account.id);
      return true;
    })
    .slice(0, LIMIT);
};
