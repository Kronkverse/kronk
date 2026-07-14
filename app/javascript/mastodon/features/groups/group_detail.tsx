import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useParams } from 'react-router-dom';

import { List as ImmutableList } from 'immutable';

import { importFetchedStatuses } from 'mastodon/actions/importer';
import {
  apiGetGroup,
  apiJoinGroup,
  apiLeaveGroup,
  apiArchiveGroup,
  apiGetGroupStatuses,
  apiPostGroupStatus,
} from 'mastodon/api/groups';
import type { ApiGroupJSON } from 'mastodon/api/groups';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import StatusList from 'mastodon/components/status_list';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'groups.detail.title', defaultMessage: 'Group' },
});

export const GroupDetail = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const [group, setGroup] = useState<ApiGroupJSON | null>(null);
  const [statusIds, setStatusIds] =
    useState<ImmutableList<string>>(ImmutableList());
  const [composerText, setComposerText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const [g, s] = await Promise.all([
        apiGetGroup(id),
        apiGetGroupStatuses(id, { limit: 20 }),
      ]);
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
    if (
      !window.confirm(
        'Archive this group? Posts stay resolvable but new activity is blocked.',
      )
    )
      return;
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

  const handleJoin = useCallback(() => { void doJoin(); }, [doJoin]);
  const handleLeave = useCallback(() => { void doLeave(); }, [doLeave]);
  const handleArchive = useCallback(() => { void doArchive(); }, [doArchive]);
  const handlePost = useCallback(() => { void doPost(); }, [doPost]);
  const handleComposerChange = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>(
    (e) => { setComposerText(e.target.value); },
    [],
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={group?.name ?? intl.formatMessage(messages.title)}
        showBackButton
      />

      <div className='scrollable group-detail'>
        {error && <p className='group-detail__error'>{error}</p>}

        {!group && !error && (
          <p className='group-detail__loading'>
            <FormattedMessage
              id='groups.detail.loading'
              defaultMessage='Loading…'
            />
          </p>
        )}

        {group && (
          <>
            <div className='group-detail__header'>
              <small className='group-detail__slug'>@{group.slug}</small>
              {group.archived && (
                <span className='group-detail__archived-badge'>archived</span>
              )}
            </div>

            {group.description && (
              <p className='group-detail__description'>{group.description}</p>
            )}

            <dl className='group-detail__meta'>
              <dt>Members</dt>
              <dd>{group.member_count}</dd>
              <dt>Seeders</dt>
              <dd>{group.seeder_count}</dd>
              <dt>Governance</dt>
              <dd>
                {group.governance_framework}
                {group.governance_threshold
                  ? ` (threshold ${group.governance_threshold})`
                  : ''}
              </dd>
              <dt>Discoverable</dt>
              <dd>{group.discoverable ? 'yes' : 'no'}</dd>
              {group.viewer_role && (
                <>
                  <dt>Your role</dt>
                  <dd>{group.viewer_role}</dd>
                </>
              )}
            </dl>

            <div className='group-detail__actions'>
              {!group.archived && !group.viewer_role && (
                <button
                  type='button'
                  onClick={handleJoin}
                  disabled={busy}
                  className='group-detail__btn-primary'
                >
                  <FormattedMessage
                    id='groups.detail.join'
                    defaultMessage='Join'
                  />
                </button>
              )}

              {group.viewer_role && !group.archived && (
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='group-detail__btn-secondary'
                >
                  <FormattedMessage
                    id='groups.detail.leave'
                    defaultMessage='Leave'
                  />
                </button>
              )}

              {group.viewer_role === 'seeder' && !group.archived && (
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='group-detail__btn-danger'
                >
                  <FormattedMessage
                    id='groups.detail.archive'
                    defaultMessage='Archive'
                  />
                </button>
              )}
            </div>

            {group.viewer_role && !group.archived && (
              <div className='group-detail__composer'>
                <h3>
                  <FormattedMessage
                    id='groups.detail.post_here'
                    defaultMessage='Post to this group'
                  />
                </h3>
                <textarea
                  value={composerText}
                  onChange={handleComposerChange}
                  rows={3}
                  placeholder={intl.formatMessage({
                    id: 'groups.detail.composer_placeholder',
                    defaultMessage: "What's happening in the group?",
                  })}
                />
                <button
                  type='button'
                  onClick={handlePost}
                  disabled={busy || !composerText.trim()}
                >
                  <FormattedMessage
                    id='groups.detail.post_send'
                    defaultMessage='Post'
                  />
                </button>
              </div>
            )}

            <h3 className='group-detail__timeline-heading'>
              <FormattedMessage
                id='groups.detail.timeline'
                defaultMessage='Group timeline'
              />
            </h3>
            <StatusList
              scrollKey={`group_timeline:${group.id}`}
              statusIds={statusIds}
              isLoading={loading}
              hasMore={false}
              onLoadMore={noopLoadMore}
              timelineId={`group_timeline:${group.id}`}
              emptyMessage={
                <FormattedMessage
                  id='groups.detail.empty_timeline'
                  defaultMessage='No posts yet.'
                />
              }
            />
          </>
        )}
      </div>
    </Column>
  );
};

export default GroupDetail;
