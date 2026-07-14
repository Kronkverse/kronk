/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { apiRequestGet } from 'mastodon/api';
import type { ApiUrl } from 'mastodon/api';

// Generic list-manager kit primitive (settings rebuild §7). Fetches a
// collection from an endpoint and renders each entry as a row with a remove
// button; removal is optimistic. Hooks-based and self-contained so it stays
// consistent with the other settings sections (no Redux coupling). Callers
// supply accessors (primary/secondary/avatar) + a remove callback, so the
// same shell serves accounts (mutes/blocks), domains, and — later — filters.

interface ListManagerProps<T> {
  title: string;
  description?: string;
  fetchUrl: ApiUrl;
  getKey: (item: T) => string;
  primary: (item: T) => string;
  secondary?: (item: T) => string;
  avatar?: (item: T) => string | undefined;
  removeItem: (item: T) => Promise<unknown>;
  removeLabel: string;
  emptyMessage: string;
}

interface ListManagerRowProps<T> {
  item: T;
  primary: (item: T) => string;
  secondary?: (item: T) => string;
  avatar?: (item: T) => string | undefined;
  removeLabel: string;
  onRemove: (item: T) => void;
}

const ListManagerRow = <T,>({
  item,
  primary,
  secondary,
  avatar,
  removeLabel,
  onRemove,
}: ListManagerRowProps<T>) => {
  const handleClick = useCallback(() => {
    onRemove(item);
  }, [item, onRemove]);

  const avatarUrl = avatar ? avatar(item) : undefined;
  const sub = secondary ? secondary(item) : undefined;

  return (
    <li className='settings-list-manager__item'>
      {avatarUrl && (
        <img className='settings-list-manager__avatar' src={avatarUrl} alt='' />
      )}
      <span className='settings-list-manager__labels'>
        <span className='settings-list-manager__primary'>{primary(item)}</span>
        {sub && <span className='settings-list-manager__secondary'>{sub}</span>}
      </span>
      <button
        type='button'
        className='settings-list-manager__remove'
        onClick={handleClick}
      >
        {removeLabel}
      </button>
    </li>
  );
};

export const ListManager = <T,>({
  title,
  description,
  fetchUrl,
  getKey,
  primary,
  secondary,
  avatar,
  removeItem,
  removeLabel,
  emptyMessage,
}: ListManagerProps<T>) => {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<T[]>(fetchUrl);
        if (!cancelled) {
          setItems(res);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  const handleRemove = useCallback(
    (item: T) => {
      const key = getKey(item);
      setItems((prev) => prev.filter((i) => getKey(i) !== key));
      void removeItem(item).catch(() => {
        // Re-add on failure so the row doesn't silently vanish.
        setItems((prev) => [item, ...prev]);
      });
    },
    [getKey, removeItem],
  );

  return (
    <div className='settings-list-manager'>
      <div className='settings-list-manager__header'>
        <span className='settings-list-manager__title'>{title}</span>
      </div>
      {description && (
        <p className='settings-list-manager__hint'>{description}</p>
      )}
      {!loaded ? null : items.length === 0 ? (
        <p className='settings-list-manager__empty'>{emptyMessage}</p>
      ) : (
        <ul className='settings-list-manager__list'>
          {items.map((item) => (
            <ListManagerRow
              key={getKey(item)}
              item={item}
              primary={primary}
              secondary={secondary}
              avatar={avatar}
              removeLabel={removeLabel}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
