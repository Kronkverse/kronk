import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdBring,
  apiFtdItemAction,
  apiFtdMycelium,
} from 'mastodon/api/freethedream';
import type {
  FtdItemRow,
  FtdMyceliumItem,
} from 'mastodon/api_types/freethedream';

import { act } from './act';

// "From my Mycelium" on a need or Actualise row (docs/spaces/freethedream.md,
// Mycelium): when you have something in the same category, one tap brings
// it against the need from your Mycelium (or jumps you on board the
// Actualise item). Your Mycelium is loaded once for the page, not per row;
// the closest by words comes first, as Freethedream::MyceliumMatch ranks.

const messages = defineMessages({
  open: {
    id: 'freethedream.mycelium.from_mine',
    defaultMessage: 'From my Mycelium',
  },
  pick: {
    id: 'freethedream.mycelium.pick',
    defaultMessage: 'Which of yours?',
  },
  close: { id: 'freethedream.bring.cancel', defaultMessage: 'Cancel' },
});

let cache: Promise<FtdMyceliumItem[]> | null = null;

const loadMine = () => {
  cache ??= apiFtdMycelium().catch(() => {
    cache = null;
    return [];
  });
  return cache;
};

// After bringing or sharing something, the next load is fresh.
export const forgetMyMycelium = () => {
  cache = null;
};

const STOP = new Set([
  'a', 'an', 'and', 'the', 'of', 'for', 'to', 'with', 'in', 'on', 'at',
  'some', 'any', 'my', 'our', 'your', 'x',
]); // prettier-ignore

const words = (title: string) =>
  new Set(
    (title.toLowerCase().match(/\p{L}+/gu) ?? [])
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)),
  );

const overlap = (a: string, b: string) => {
  const mine = words(a);
  let n = 0;
  words(b).forEach((w) => {
    if (mine.has(w)) n += 1;
  });
  return n;
};

const useMine = () => {
  const [mine, setMine] = useState<FtdMyceliumItem[] | null>(null);
  useEffect(() => {
    let stale = false;
    void loadMine().then((items) => {
      if (!stale) setMine(items);
    });
    return () => {
      stale = true;
    };
  }, []);
  return mine;
};

export const FromMyMycelium: React.FC<{
  item: FtdItemRow;
  onDone: () => void;
}> = ({ item, onDone }) => {
  const intl = useIntl();
  const mine = useMine();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const handlePick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const picked = mine?.find((m) => m.id === e.currentTarget.dataset.id);
      if (!picked) return;
      setBusy(true);
      const request =
        item.kind === 'need'
          ? apiFtdBring(
              item.id,
              Math.max(1, Math.min(picked.quantity, item.left ?? 1)),
              picked.id,
            )
          : apiFtdItemAction(item.id, 'claim');
      void act(
        request.then(() => {
          forgetMyMycelium();
          setOpen(false);
          onDone();
        }),
      ).finally(() => {
        setBusy(false);
      });
    },
    [mine, item, onDone],
  );

  // Already bringing it, or already on it: nothing to offer here.
  const taken =
    item.kind === 'need' ? (item.my_quantity ?? 0) > 0 : !!item.claimed_by_me;
  const matches =
    mine && item.category && !taken
      ? mine
          .filter((m) => m.category === item.category)
          .map((m) => ({ m, score: overlap(m.title, item.title) }))
          .sort(
            (a, b) => b.score - a.score || a.m.title.localeCompare(b.m.title),
          )
          .map(({ m }) => m)
      : [];

  if (matches.length === 0) return null;

  return (
    <span className='freethedream-mycelium-pick'>
      <button
        type='button'
        className='freethedream__link'
        onClick={handleOpen}
        aria-expanded={open}
      >
        {intl.formatMessage(open ? messages.close : messages.open)}
      </button>
      {open && (
        <span
          className='freethedream-mycelium-pick__list'
          role='group'
          aria-label={intl.formatMessage(messages.pick)}
        >
          {matches.slice(0, 5).map((m) => (
            <button
              key={m.id}
              type='button'
              className='freethedream-more'
              data-id={m.id}
              onClick={handlePick}
              disabled={busy}
            >
              {m.quantity > 1 ? `${m.title} ×${m.quantity}` : m.title}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};
