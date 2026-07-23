/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { List as ImmutableList } from 'immutable';

import { changeComposeKrewTargets } from 'mastodon/actions/compose';
import { apiRequestGet } from 'mastodon/api';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compact multi-select for targeting a post at one or more Krews.
// Renders a chip per selected krew + an "add" affordance that lists
// krews the current user is a member of. Server-side, statuses can
// be attached to N krews (see statuses_krews join).

export const KrewTargets = () => {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(
    (state) =>
      (state.compose.get('krew_ids') ??
        ImmutableList()) as ImmutableList<string>,
  );

  const [available, setAvailable] = useState<ApiKrewJSON[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const krews = await apiRequestGet<ApiKrewJSON[]>('v1/krews', {
          limit: 100,
        });
        if (!cancelled) {
          // Only show krews the viewer is a member of.
          setAvailable(
            krews.filter((k) => k.viewer_role !== null && !k.archived),
          );
        }
      } catch {
        // Best-effort — composer stays usable without krews.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleKrew = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : selectedIds.push(id);
      dispatch(changeComposeKrewTargets(next.toArray()));
    },
    [dispatch, selectedIds],
  );

  const removeKrew = useCallback(
    (id: string) => {
      const next = selectedIds.filter((x) => x !== id);
      dispatch(changeComposeKrewTargets(next.toArray()));
    },
    [dispatch, selectedIds],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) removeKrew(id);
    },
    [removeKrew],
  );

  const handleToggleOpen = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const handleToggle = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) toggleKrew(id);
    },
    [toggleKrew],
  );

  if (available.length === 0 && selectedIds.size === 0) return null;

  const byId = new Map(available.map((k) => [k.id, k] as const));

  return (
    <div className='compose-form__group-targets'>
      {selectedIds.map((id) => {
        const krew = byId.get(id);
        return (
          <span key={id} className='compose-form__group-chip'>
            {krew?.name ?? `#${id}`}
            <button
              type='button'
              data-id={id}
              onClick={handleRemove}
              aria-label='Remove krew target'
              className='compose-form__group-chip-remove'
            >
              ×
            </button>
          </span>
        );
      })}

      <button
        type='button'
        onClick={handleToggleOpen}
        className='compose-form__group-target-toggle'
        aria-expanded={open}
      >
        {selectedIds.size === 0 ? (
          <FormattedMessage
            id='compose.krew_targets.add'
            defaultMessage='+ Post to krew…'
          />
        ) : (
          <FormattedMessage
            id='compose.krew_targets.more'
            defaultMessage='+ Another krew'
          />
        )}
      </button>

      {open && (
        <div role='menu' className='compose-form__group-target-menu'>
          {available.length === 0 && (
            <p className='compose-form__group-target-empty'>
              <FormattedMessage
                id='compose.krew_targets.none'
                defaultMessage='No krews yet.'
              />
            </p>
          )}
          {available.map((k) => {
            const selected = selectedIds.includes(k.id);
            return (
              <button
                key={k.id}
                type='button'
                role='menuitemcheckbox'
                aria-checked={selected}
                data-id={k.id}
                onClick={handleToggle}
                className={`compose-form__group-target-option ${selected ? 'compose-form__group-target-option--active' : ''}`}
              >
                {selected ? '✓ ' : ''}
                {k.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
