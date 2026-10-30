// A Kuddle's call, wherever it's shown: the Kuddle's own page
// (room.tsx) and a frame in a space it's Konnected to (kuddle_frame.tsx).
//
// The call lives on document.body (huddle_pip/jitsi_session.ts) and is
// drawn over `slotRef` while the page that owns it is open. Leaving that
// page mid-call moves it into the floating mini window, whose Back goes to
// `path`; coming back to a page showing the same Kuddle picks the same
// call up. One call at a time: joining ends any other.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  huddleExpanded,
  huddleJoined,
  huddleLeft,
  huddleMinimized,
} from 'mastodon/actions/huddle';
import { apiRequestPost } from 'mastodon/api';
import {
  createJitsiContainer,
  disposeJitsiSession,
  getJitsiSession,
  getJitsiSessionFor,
  setJitsiSession,
  setJitsiSlot,
} from 'mastodon/features/huddle_pip/jitsi_session';
import { me } from 'mastodon/initial_state';
import type { Call } from 'mastodon/jitsi';
import { createCall, getCallPass, loadJitsi } from 'mastodon/jitsi';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

export interface KuddleCallRoom {
  id: string;
  name: string;
}

interface Options {
  // Where the mini window's Back goes: the page showing this call.
  path: string;
  // Join as soon as the Kuddle is known (its own page), or only on join().
  autoJoin: boolean;
  // After Unhuddle, or hanging up inside the call, while the page is open.
  onLeft?: () => void;
}

export const useKuddleCall = (
  roomId: string,
  room: KuddleCallRoom | null,
  { path, autoJoin, onLeft }: Options,
) => {
  const dispatch = useAppDispatch();
  const placeKey = `kuddle:${roomId}`;
  const slotRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<Call | null>(null);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  const [call, setCall] = useState<Call | null>(null);
  const [wanted, setWanted] = useState(autoJoin);
  const [joinFailed, setJoinFailed] = useState(false);
  const currentAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  // Coming back from the mini window picks this Kuddle's call up again.
  // Leaving the page mid-call keeps it: it moves into the mini window.
  useEffect(() => {
    mountedRef.current = true;
    const existing = getJitsiSessionFor(placeKey);
    joinedRef.current = false;
    callRef.current = null;
    setCall(null);
    if (existing) {
      joinedRef.current = true;
      callRef.current = existing.call;
      setCall(existing.call);
      dispatch(huddleExpanded());
    }
    return () => {
      mountedRef.current = false;
      const ours = getJitsiSessionFor(placeKey);
      if (ours && ours.call === callRef.current) {
        dispatch(
          huddleMinimized({
            participantCount: ours.call.api.getNumberOfParticipants(),
          }),
        );
      }
    };
  }, [placeKey, dispatch]);

  // The call ended away from this page (hung up from the mini window before
  // coming back, say): nothing to show.
  const huddleActive = useAppSelector((state) => state.huddle.active);
  useEffect(() => {
    if (huddleActive || !callRef.current) return;
    if (getJitsiSession()?.call === callRef.current) return;
    callRef.current = null;
    setCall(null);
  }, [huddleActive]);

  // Show the call over the page's call area while you're in it. The area is
  // drawn once the Kuddle is in, which can be after the call (coming back
  // from the mini window).
  const roomShown = room !== null;
  useEffect(() => {
    if (!call || !roomShown) return undefined;
    const el = slotRef.current;
    setJitsiSlot(el);
    return () => {
      setJitsiSlot(null, el ?? undefined);
    };
  }, [call, roomShown]);

  // Unhuddle, here or (hanging up inside the call) in the mini window.
  const leave = useCallback(() => {
    disposeJitsiSession(callRef.current ?? undefined);
    callRef.current = null;
    joinedRef.current = false;
    dispatch(huddleLeft());
    if (!mountedRef.current) return;
    setCall(null);
    setWanted(false);
    onLeft?.();
  }, [dispatch, onLeft]);

  const join = useCallback(() => {
    setJoinFailed(false);
    setWanted(true);
  }, []);

  // Once the Kuddle is known and someone wants in, get a pass and embed the
  // call. `joinedRef` keeps it to one embed per join.
  useEffect(() => {
    if (!room || !wanted || joinedRef.current) return;
    joinedRef.current = true;

    void Promise.all([loadJitsi(), getCallPass('kuddle', room.id)])
      .then(([, pass]) => {
        if (!mountedRef.current) return undefined;
        const displayName =
          currentAccount?.get('display_name') ??
          currentAccount?.get('username') ??
          'Kronker';
        const container = createJitsiContainer();
        const created = createCall({
          parentNode: container,
          pass,
          displayName,
          avatarUrl: currentAccount?.get('avatar'),
          subject: room.name,
        });
        if (!created) {
          container.remove();
          joinedRef.current = false;
          setJoinFailed(true);
          return undefined;
        }
        // Hanging up inside Jitsi leaves the Kuddle, same as Unhuddle.
        created.api.addListener('readyToClose', () => {
          if (getJitsiSession()?.call === created) leave();
        });
        callRef.current = created;
        setCall(created);
        // One call at a time: this ends a call already in the mini window.
        setJitsiSession({
          call: created,
          container,
          place: { key: placeKey, path, name: room.name },
        });
        dispatch(huddleJoined());
        // Tell Kronk the Kuddle is in use (keeps it listed first, and keeps
        // the reaper away). Best effort: the call doesn't depend on it.
        void apiRequestPost(`v1/huddle/rooms/${room.id}/join`).catch(() => {
          /* best effort */
        });
        return undefined;
      })
      .catch(() => {
        joinedRef.current = false;
        if (mountedRef.current) setJoinFailed(true);
      });
  }, [room, wanted, currentAccount, leave, dispatch, placeKey, path]);

  return { call, join, leave, joinFailed, slotRef };
};
