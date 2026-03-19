import { Map as ImmutableMap, List as ImmutableList, fromJS } from 'immutable';

import {
  FRIENDS_ACTIVITY_EXPAND_REQUEST,
  FRIENDS_ACTIVITY_EXPAND_SUCCESS,
  FRIENDS_ACTIVITY_EXPAND_FAIL,
} from '../actions/friends_activity';

const initialState = ImmutableMap({
  items: ImmutableList(),
  isLoading: false,
  hasMore: true,
});

interface FriendsActivityAction {
  type: string;
  items?: {
    statusId: string;
    interactions: {
      type: string;
      accountId: string;
      created_at: string;
    }[];
  }[];
  hasMore?: boolean;
  maxId?: string;
  error?: unknown;
}

// eslint-disable-next-line import/no-default-export
export default function friendsActivity(
  state = initialState,
  action: FriendsActivityAction,
) {
  switch (action.type) {
    case FRIENDS_ACTIVITY_EXPAND_REQUEST:
      return state.set('isLoading', true);
    case FRIENDS_ACTIVITY_EXPAND_SUCCESS:
      return state.withMutations((map) => {
        const newItems = fromJS(action.items ?? []);
        if (action.maxId) {
          map.update('items', (list) =>
            (list as ImmutableList<unknown>).concat(newItems),
          );
        } else {
          map.set('items', newItems);
        }
        map.set('isLoading', false);
        map.set('hasMore', action.hasMore ?? false);
      });
    case FRIENDS_ACTIVITY_EXPAND_FAIL:
      return state.set('isLoading', false);
    default:
      return state;
  }
}
