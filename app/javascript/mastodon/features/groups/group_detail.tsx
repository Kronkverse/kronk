import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { List as ImmutableList } from 'immutable';

import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import StatusList from 'mastodon/components/status_list';
import { importFetchedStatuses } from 'mastodon/actions/importer';
import { useAppDispatch } from 'mastodon/store';
import {
  apiGetGroup,
  apiJoinGroup,
  apiLeaveGroup,
  apiArchiveGroup,
  apiGetGroupStatuses,
  apiPostGroupStatus,
} from 'mastodon/api/groups';
import type { ApiGroupJSON } from 'mastodon/api/groups';

const messages = defineMessages({
  title: { id: 'groups.detail.title', defaultMessage: 'Group' },
});

export const GroupDetail = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const [group, setGroup] = useState<ApiGroupJSON | null>(null);
  const [statusIds, setStatusIds] = useState<ImmutableList<string>>(ImmutableList());
  const [composerText, setComposerText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const [g, s] = await Promise.all([apiGetGroup(id), apiGetGroupStatuses(id, { limit: 20 })]);
      setGroup(g);
      dispatch(importFetchedStatuses(s));
      setStatusIds(ImmutableList(s.map((st) => st.id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, dispatch]);

  const noopLoadMore = useCallback(() => undefined, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const doPost = async () => {
    if (!id || !composerText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPostGroupStatus(id, { status: composerText.trim() });
      setComposerText('');
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiJoinGroup(id);
      setGroup(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doLeave = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiLeaveGroup(id);
      setGroup(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doArchive = async () => {
    if (!id) return;
    if (!window.confirm('Archive this group? Posts stay resolvable but new activity is blocked.')) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiArchiveGroup(id);
      setGroup(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={group?.name ?? intl.formatMessage(messages.title)}
        showBackButton
      />

      <div className='scrollable' style={{ padding: '1rem' }}>
        {error && <p style={{ color: 'var(--warning-red, tomato)' }}>{error}</p>}

        {!group && !error && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage id='groups.detail.loading' defaultMessage='Loading…' />
          </p>
        )}

        {group && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <small style={{ color: 'var(--text-muted)' }}>@{group.slug}</small>
              {group.archived && (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-round, 999px)',
                    fontSize: '0.7rem',
                    background: 'var(--surface-elevated)',
                    color: 'var(--text-muted)',
                  }}
                >
                  archived
                </span>
              )}
            </div>

            {group.description && (
              <p style={{ marginBottom: '1rem' }}>{group.description}</p>
            )}

            <dl style={{ marginBottom: '1rem' }}>
              <dt style={{ color: 'var(--text-muted)' }}>Members</dt>
              <dd style={{ marginInlineStart: 0 }}>{group.member_count}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Seeders</dt>
              <dd style={{ marginInlineStart: 0 }}>{group.seeder_count}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>Governance</dt>
              <dd style={{ marginInlineStart: 0 }}>
                {group.governance_framework}
                {group.governance_threshold ? ` (threshold ${group.governance_threshold})` : ''}
              </dd>
              <dt style={{ color: 'var(--text-muted)' }}>Discoverable</dt>
              <dd style={{ marginInlineStart: 0 }}>{group.discoverable ? 'yes' : 'no'}</dd>
              {group.viewer_role && (
                <>
                  <dt style={{ color: 'var(--text-muted)' }}>Your role</dt>
                  <dd style={{ marginInlineStart: 0 }}>{group.viewer_role}</dd>
                </>
              )}
            </dl>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {!group.archived && !group.viewer_role && (
                <button
                  type='button'
                  onClick={() => void doJoin()}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--accent)', color: 'var(--surface-primary)', cursor: 'pointer' }}
                >
                  <FormattedMessage id='groups.detail.join' defaultMessage='Join' />
                </button>
              )}

              {group.viewer_role && !group.archived && (
                <button
                  type='button'
                  onClick={() => void doLeave()}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <FormattedMessage id='groups.detail.leave' defaultMessage='Leave' />
                </button>
              )}

              {group.viewer_role === 'seeder' && !group.archived && (
                <button
                  type='button'
                  onClick={() => void doArchive()}
                  disabled={busy}
                  style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--surface-elevated)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <FormattedMessage id='groups.detail.archive' defaultMessage='Archive' />
                </button>
              )}
            </div>

            {group.viewer_role && !group.archived && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--surface-elevated)' }}>
                <h3 style={{ marginTop: 0 }}>
                  <FormattedMessage id='groups.detail.post_here' defaultMessage='Post to this group' />
                </h3>
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  rows={3}
                  placeholder={intl.formatMessage({ id: 'groups.detail.composer_placeholder', defaultMessage: "What's happening in the group?" })}
                  style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                />
                <button
                  type='button'
                  onClick={() => void doPost()}
                  disabled={busy || !composerText.trim()}
                  style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--accent)', color: 'var(--surface-primary)', cursor: 'pointer' }}
                >
                  <FormattedMessage id='groups.detail.post_send' defaultMessage='Post' />
                </button>
              </div>
            )}

            <h3>
              <FormattedMessage id='groups.detail.timeline' defaultMessage='Group timeline' />
            </h3>
            <StatusList
              scrollKey={`group_timeline:${group.id}`}
              statusIds={statusIds}
              isLoading={loading}
              hasMore={false}
              onLoadMore={noopLoadMore}
              timelineId={`group_timeline:${group.id}`}
              emptyMessage={
                <FormattedMessage id='groups.detail.empty_timeline' defaultMessage='No posts yet.' />
              }
            />
          </>
        )}
      </div>
    </Column>
  );
};

export default GroupDetail;
