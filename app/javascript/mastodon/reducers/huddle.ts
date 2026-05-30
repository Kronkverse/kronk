import type { Reducer } from '@reduxjs/toolkit';

import {
  huddleJoined,
  huddleLeft,
  huddleMinimized,
  huddleExpanded,
} from 'mastodon/actions/huddle';

interface HuddleState {
  active: boolean;
  minimized: boolean;
  participantCount: number;
}

const initialState: HuddleState = {
  active: false,
  minimized: false,
  participantCount: 0,
};

export const huddleReducer: Reducer<HuddleState> = (
  state = initialState,
  action,
) => {
  if (huddleJoined.match(action))
    return { active: true, minimized: false, participantCount: 0 };
  else if (huddleLeft.match(action)) return initialState;
  else if (huddleMinimized.match(action))
    return {
      active: true,
      minimized: true,
      participantCount: action.payload.participantCount,
    };
  else if (huddleExpanded.match(action)) return { ...state, minimized: false };

  return state;
};
