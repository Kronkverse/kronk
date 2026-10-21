import { useCallback, useEffect, useRef, useState } from 'react';

import { apiRequestGet, apiRequestPut } from 'mastodon/api';
import type { SaveStatus } from 'mastodon/features/settings/components';
import { useSaveQueue } from 'mastodon/hooks/useSaveQueue';

// Which nudges reach you, in Nudges and on your phone, and your quiet
// hours: /api/v1/settings/nudges (docs/spaces/nudges.md, Nudge settings
// and Push). Shared by /settings/notifications and each korner's settings
// page, so a change on one is what the other loads.

export interface NudgeSettingRow {
  key: string;
  korner?: string | null;
  korner_name?: string | null;
  label: string;
  // Muted: not delivered at all, so not pushed either. Message rows can't be.
  muted?: boolean;
  push: boolean;
}

export interface QuietHours {
  start: string;
  end: string;
}

interface Payload {
  types: NudgeSettingRow[];
  message_types: NudgeSettingRow[];
  muted_types: string[];
  push_off_types: string[];
  quiet_hours: QuietHours;
}

export function useNudgeSettings() {
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const dataRef = useRef<Payload | null>(null);
  dataRef.current = data;
  const queueSave = useSaveQueue();

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<Payload>('v1/settings/nudges')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Show the change at once, send it, then take the server's whole answer
  // (unless a newer change has gone since); put it back if it failed.
  const save = useCallback(
    async (next: Payload, body: Partial<Payload>) => {
      const previous = dataRef.current;
      setData(next);
      setStatus('saving');
      const { done, isLatest } = queueSave(() =>
        apiRequestPut<Payload>('v1/settings/nudges', body),
      );
      try {
        const res = await done;
        if (!isLatest()) return;
        setData(res);
        setStatus('saved');
      } catch {
        if (!isLatest()) return;
        setData(previous);
        setStatus('error');
      }
    },
    [queueSave],
  );

  const setShown = useCallback(
    (key: string, shown: boolean) => {
      const current = dataRef.current;
      if (!current) return;
      const types = current.types.map((t) =>
        t.key === key ? { ...t, muted: !shown } : t,
      );
      const muted_types = types.filter((t) => t.muted).map((t) => t.key);
      void save({ ...current, types, muted_types }, { muted_types });
    },
    [save],
  );

  const setPushed = useCallback(
    (key: string, pushed: boolean) => {
      const current = dataRef.current;
      if (!current) return;
      const flip = (rows: NudgeSettingRow[]) =>
        rows.map((t) => (t.key === key ? { ...t, push: pushed } : t));
      const off = new Set(current.push_off_types);
      if (pushed) off.delete(key);
      else off.add(key);
      const push_off_types = Array.from(off);
      void save(
        {
          ...current,
          types: flip(current.types),
          message_types: flip(current.message_types),
          push_off_types,
        },
        { push_off_types },
      );
    },
    [save],
  );

  const setQuietHours = useCallback(
    (quiet_hours: QuietHours) => {
      const current = dataRef.current;
      if (!current) return;
      void save({ ...current, quiet_hours }, { quiet_hours });
    },
    [save],
  );

  return {
    loaded: data !== null,
    types: data?.types ?? [],
    messageTypes: data?.message_types ?? [],
    quietHours: data?.quiet_hours ?? null,
    status,
    setShown,
    setPushed,
    setQuietHours,
  };
}
