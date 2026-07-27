import { useEffect, useState } from 'react';

// Poll the Jitsi Prosody room-info endpoint to get a live participant
// count for a given room. Unauthenticated, CORS-open — same endpoint
// the Live component's lobby uses.
//
// - Returns null while the first fetch is in flight (so the UI can
//   render "quiet" without flashing "0 here").
// - Returns 0 when Prosody 404s (the room hasn't been instantiated
//   because nobody's joined yet — semantically identical to empty).
// - Polls every POLL_MS after the first fetch.
//
// The presence signal is best-effort: a failing fetch degrades to 0
// rather than surfacing an error, since the landing is more useful
// with a stale "quiet" than a broken chip.

const JITSI_DOMAIN = 'meet.talitamoss.info';
const POLL_MS = 15_000;

interface JitsiParticipant {
  jid: string;
  display_name: string;
  email: string;
}

const fetchRoomCount = async (roomName: string): Promise<number> => {
  const url = `https://${JITSI_DOMAIN}/room?room=${encodeURIComponent(roomName)}&domain=meet.jitsi`;
  const response = await fetch(url);
  if (response.status === 404) return 0;
  if (!response.ok) return 0;
  const data = (await response.json()) as JitsiParticipant[];
  return Array.isArray(data) ? data.length : 0;
};

export const useRoomPresence = (roomName: string): number | null => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await fetchRoomCount(roomName);
        if (!cancelled) setCount(next);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomName]);

  return count;
};
