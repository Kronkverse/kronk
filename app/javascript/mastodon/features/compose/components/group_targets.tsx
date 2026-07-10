import { useEffect, useState, useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { List as ImmutableList } from 'immutable';

import { apiRequestGet } from 'mastodon/api';
import type { ApiGroupJSON } from 'mastodon/api/groups';
import { changeComposeGroupTargets } from 'mastodon/actions/compose';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compact multi-select for targeting a post at one or more Groups.
// Renders a chip per selected group + an "add" affordance that lists
// groups the current user is a member of. Server-side, statuses can
// be attached to N groups (see statuses_groups join).

export const GroupTargets = () => {
  const dispatch = useAppDispatch();
  const selectedIds = useAppSelector(
    (state) => (state.compose.get('group_ids') ?? ImmutableList()) as ImmutableList<string>,
  );

  const [available, setAvailable] = useState<ApiGroupJSON[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const groups = await apiRequestGet<ApiGroupJSON[]>('v1/groups', { limit: 100 });
        if (!cancelled) {
          // Only show groups the viewer is a member of.
          setAvailable(groups.filter((g) => g.viewer_role !== null && !g.archived));
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

  if (available.length === 0 && selectedIds.size === 0) return null;

  const byId = new Map(available.map((g) => [g.id, g] as const));

  return (
    <div className='compose-form__group-targets' style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', padding: '0.25rem 0.5rem' }}>
      {selectedIds.map((id) => {
        const group = byId.get(id);
        return (
          <span
            key={id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.15rem 0.55rem',
              borderRadius: '999px',
              background: 'var(--kronk-purple-deep)',
              color: 'var(--kronk-purple-accent)',
              fontSize: '0.85rem',
            }}
          >
            {group?.name ?? `#${id}`}
            <button
              type='button'
              onClick={() => removeGroup(id)}
              aria-label='Remove group target'
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: '0.15rem' }}
            >
              ×
            </button>
          </span>
        );
      })}

      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '0.15rem 0.65rem',
          borderRadius: '999px',
          background: 'transparent',
          border: '1px dashed var(--border-default)',
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        {selectedIds.size === 0 ? (
          <FormattedMessage id='compose.group_targets.add' defaultMessage='+ Post to group…' />
        ) : (
          <FormattedMessage id='compose.group_targets.more' defaultMessage='+ Another group' />
        )}
      </button>

      {open && (
        <div
          role='menu'
          style={{
            position: 'absolute',
            marginTop: '2rem',
            padding: '0.35rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-medium, 8px)',
            minWidth: '14rem',
            zIndex: 10,
          }}
        >
          {available.length === 0 && (
            <p style={{ margin: 0, padding: '0.5rem', color: 'var(--text-muted)' }}>
              <FormattedMessage id='compose.group_targets.none' defaultMessage='No groups yet.' />
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
                onClick={() => toggleGroup(g.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.4rem 0.6rem',
                  background: selected ? 'var(--kronk-purple-deep)' : 'transparent',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-small, 6px)',
                  cursor: 'pointer',
                }}
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
