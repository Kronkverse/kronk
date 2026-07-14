import { useEffect, useState, useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { List as ImmutableList } from 'immutable';

import { changeComposeGroupTargets } from 'mastodon/actions/compose';
import { apiRequestGet } from 'mastodon/api';
import type { ApiGroupJSON } from 'mastodon/api/groups';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compact multi-select for targeting a post at one or more Groups.
// Renders a chip per selected group + an "add" affordance that lists
// groups the current user is a member of. Server-side, statuses can
// be attached to N groups (see statuses_groups join).

export const GroupTargets = () => {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(
    (state) =>
      (state.compose.get('group_ids') ??
        ImmutableList()) as ImmutableList<string>,
  );

  const [available, setAvailable] = useState<ApiGroupJSON[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const groups = await apiRequestGet<ApiGroupJSON[]>('v1/groups', {
          limit: 100,
        });
        if (!cancelled) {
          // Only show groups the viewer is a member of.
          setAvailable(
            groups.filter((g) => g.viewer_role !== null && !g.archived),
          );
        }
      } catch {
        // Best-effort — composer stays usable without groups.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleGroup = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : selectedIds.push(id);
      dispatch(changeComposeGroupTargets(next.toArray()));
    },
    [dispatch, selectedIds],
  );

  const removeGroup = useCallback(
    (id: string) => {
      const next = selectedIds.filter((x) => x !== id);
      dispatch(changeComposeGroupTargets(next.toArray()));
    },
    [dispatch, selectedIds],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) removeGroup(id);
    },
    [removeGroup],
  );

  const handleToggleOpen = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const handleToggle = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const id = e.currentTarget.dataset.id;
      if (id) toggleGroup(id);
    },
    [toggleGroup],
  );

  if (available.length === 0 && selectedIds.size === 0) return null;

  const byId = new Map(available.map((g) => [g.id, g] as const));

  return (
    <div className='compose-form__group-targets'>
      {selectedIds.map((id) => {
        const group = byId.get(id);
        return (
          <span key={id} className='compose-form__group-chip'>
            {group?.name ?? `#${id}`}
            <button
              type='button'
              data-id={id}
              onClick={handleRemove}
              aria-label='Remove group target'
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
            id='compose.group_targets.add'
            defaultMessage='+ Post to group…'
          />
        ) : (
          <FormattedMessage
            id='compose.group_targets.more'
            defaultMessage='+ Another group'
          />
        )}
      </button>

      {open && (
        <div role='menu' className='compose-form__group-target-menu'>
          {available.length === 0 && (
            <p className='compose-form__group-target-empty'>
              <FormattedMessage
                id='compose.group_targets.none'
                defaultMessage='No groups yet.'
              />
            </p>
          )}
          {available.map((g) => {
            const selected = selectedIds.includes(g.id);
            return (
              <button
                key={g.id}
                type='button'
                role='menuitemcheckbox'
                aria-checked={selected}
                data-id={g.id}
                onClick={handleToggle}
                className={`compose-form__group-target-option ${selected ? 'compose-form__group-target-option--active' : ''}`}
              >
                {selected ? '✓ ' : ''}
                {g.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
