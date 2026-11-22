import { useCallback, useEffect, useState } from 'react';

import { apiCreateAnthemosAsk, apiGetAnthemosAsk } from 'mastodon/api/anthemos';
import type {
  AnthemosAskKind,
  ApiAnthemosAskJSON,
} from 'mastodon/api/anthemos';

// Asks Anthemos on this phone to do something (docs/spaces/map.md, Asks from
// Kronk). Kronk makes the ask, opens Anthemos on it with an intent link that
// carries only its id, and watches it until the phone answers: Allow or Not
// now, tapped on the phone. Any feature that needs the phone uses this; the
// kinds are in app/models/anthemos_ask.rb.

export const ANTHEMOS_PACKAGE = 'com.anthemos.app.two';

const WATCH_MS = 2000;

const handOver = (ask: ApiAnthemosAskJSON) => {
  const { origin, host } = window.location;
  const params = new URLSearchParams({
    id: ask.id,
    server: host,
    for: ask.account.acct,
  });
  const fallback = encodeURIComponent(`${origin}/hub/map?anthemos=missing`);
  window.location.href =
    `intent://kronk/ask?${params.toString()}` +
    `#Intent;scheme=anthemos;package=${ANTHEMOS_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`;
};

export const useAnthemosAsk = () => {
  const [ask, setAsk] = useState<ApiAnthemosAskJSON | null>(null);
  const [failed, setFailed] = useState(false);

  const start = useCallback(
    async (kind: AnthemosAskKind, payload: Record<string, string> = {}) => {
      setFailed(false);
      try {
        const made = await apiCreateAnthemosAsk(kind, payload);
        setAsk(made);
        handOver(made);
      } catch {
        setAsk(null);
        setFailed(true);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setAsk(null);
    setFailed(false);
  }, []);

  // Watch a waiting ask for the phone's answer. It stops by itself: Kronk
  // calls it expired after a few minutes.
  const id = ask?.id;
  const waiting = ask?.status === 'waiting';
  useEffect(() => {
    if (!id || !waiting) return;
    const timer = window.setInterval(() => {
      apiGetAnthemosAsk(id)
        .then(setAsk)
        .catch(() => undefined);
    }, WATCH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [id, waiting]);

  return { ask, failed, start, clear };
};
