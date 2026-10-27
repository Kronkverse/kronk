import { useSyncExternalStore } from 'react';

import type { Call, CallState } from 'mastodon/jitsi';

const subscribeToNothing = () => () => undefined;
const noState = () => null;

// What a call's controls show, kept from its events (mastodon/jitsi.ts).
// The state lives with the call, not the component, so the Huddle's mini
// window and its page show the same thing as the call moves between them.
export const useCallState = (call: Call | null): CallState | null =>
  useSyncExternalStore<CallState | null>(
    call ? call.subscribe : subscribeToNothing,
    call ? call.getState : noState,
  );
