import { createAction } from '@reduxjs/toolkit';

export const huddleJoined = createAction('huddle/joined');
export const huddleLeft = createAction('huddle/left');
export const huddleMinimized = createAction<{ participantCount: number }>(
  'huddle/minimized',
);
export const huddleExpanded = createAction('huddle/expanded');
