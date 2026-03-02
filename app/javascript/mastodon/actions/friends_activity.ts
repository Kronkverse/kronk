import api, { getLinks } from 'mastodon/api';
import type { AppDispatch, RootState } from 'mastodon/store';

import { importFetchedStatuses, importFetchedAccounts } from './importer';

export const FRIENDS_ACTIVITY_EXPAND_REQUEST =
  'FRIENDS_ACTIVITY_EXPAND_REQUEST';
export const FRIENDS_ACTIVITY_EXPAND_SUCCESS =
  'FRIENDS_ACTIVITY_EXPAND_SUCCESS';
export const FRIENDS_ACTIVITY_EXPAND_FAIL = 'FRIENDS_ACTIVITY_EXPAND_FAIL';

interface Interaction {
  type: string;
  account: Record<string, unknown>;
  created_at: string;
}

interface FriendsActivityItem {
  id: string;
  status: Record<string, unknown>;
  interactions: Interaction[];
}

export function expandFriendsActivity({ maxId }: { maxId?: string } = {}) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
     
    const isLoading = getState().friends_activity.get('isLoading');
    if (isLoading) return;

    dispatch({ type: FRIENDS_ACTIVITY_EXPAND_REQUEST });

    const params: Record<string, string> = {};
    if (maxId) params.max_id = maxId;

    api()
      .get<FriendsActivityItem[]>('/api/v1/timelines/friends_activity', {
        params,
      })
      .then((response) => {
        const items = response.data;
        const statuses = items.map((item) => item.status);
        const accounts = items.flatMap((item) =>
          item.interactions.map((i) => i.account),
        );

        dispatch(importFetchedStatuses(statuses));
        dispatch(importFetchedAccounts(accounts));

        const links = getLinks(response);
        const next = links.refs.find(
          (link: { rel: string }) => link.rel === 'next',
        );
        const hasMore = !!next;

        dispatch({
          type: FRIENDS_ACTIVITY_EXPAND_SUCCESS,
          items: items.map((item) => ({
            statusId: (item.status as { id: string }).id,
            interactions: item.interactions.map((i) => ({
              type: i.type,
              accountId: (i.account as { id: string }).id,
              created_at: i.created_at,
            })),
          })),
          hasMore,
          maxId,
        });
      })
      .catch((error: unknown) => {
        dispatch({ type: FRIENDS_ACTIVITY_EXPAND_FAIL, error: error as Error });
      });
  };
}
