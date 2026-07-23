import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams } from 'react-router-dom';

import { List as ImmutableList } from 'immutable';

import { importFetchedStatuses } from 'mastodon/actions/importer';
import {
  apiGetKrew,
  apiJoinKrew,
  apiLeaveKrew,
  apiArchiveKrew,
  apiGetKrewStatuses,
  apiPostKrewStatus,
} from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';
import StatusList from 'mastodon/components/status_list';
import { useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'krew.detail.title', defaultMessage: 'Krew' },
  back: { id: 'krew.detail.back', defaultMessage: '← Back to Krews' },
});

export const KrewDetail = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id?: string }>();
  const [krew, setKrew] = useState<ApiKrewJSON | null>(null);
  const [statusIds, setStatusIds] =
    useState<ImmutableList<string>>(ImmutableList());
  const [composerText, setComposerText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const [k, s] = await Promise.all([
        apiGetKrew(id),
        apiGetKrewStatuses(id, { limit: 20 }),
      ]);
      setKrew(k);
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

  const doPost = useCallback(async () => {
    if (!id || !composerText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPostKrewStatus(id, { status: composerText.trim() });
      setComposerText('');
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id, composerText, refetch]);

  const doJoin = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiJoinKrew(id);
      setKrew(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id]);

  const doLeave = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiLeaveKrew(id);
      setKrew(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id]);

  const doArchive = useCallback(async () => {
    if (!id) return;
    if (
      !window.confirm(
        'Archive this krew? Posts stay resolvable but new activity is blocked.',
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiArchiveKrew(id);
      setKrew(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id]);

  const handleJoin = useCallback(() => {
    void doJoin();
  }, [doJoin]);
  const handleLeave = useCallback(() => {
    void doLeave();
  }, [doLeave]);
  const handleArchive = useCallback(() => {
    void doArchive();
  }, [doArchive]);
  const handlePost = useCallback(() => {
    void doPost();
  }, [doPost]);
  const handleComposerChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setComposerText(e.target.value);
  }, []);

  return (
    <Stage label={krew?.name ?? intl.formatMessage(messages.title)}>
      <div className='scrollable group-detail'>
        <Link to='/hub/krew' className='group-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>

        {error && <p className='group-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='group-detail__loading'>
            <FormattedMessage
              id='krew.detail.loading'
              defaultMessage='Loading…'
            />
          </p>
        )}

        {krew && (
          <>
            <div className='group-detail__header'>
              <small className='group-detail__slug'>@{krew.slug}</small>
              {krew.archived && (
                <span className='group-detail__archived-badge'>archived</span>
              )}
            </div>

            {krew.description && (
              <p className='group-detail__description'>{krew.description}</p>
            )}

            <dl className='group-detail__meta'>
              <dt>Members</dt>
              <dd>{krew.member_count}</dd>
              <dt>Seeders</dt>
              <dd>{krew.seeder_count}</dd>
              <dt>Governance</dt>
              <dd>
                {krew.governance_framework}
                {krew.governance_threshold
                  ? ` (threshold ${krew.governance_threshold})`
                  : ''}
              </dd>
              <dt>Discoverable</dt>
              <dd>{krew.discoverable ? 'yes' : 'no'}</dd>
              {krew.viewer_role && (
                <>
                  <dt>Your role</dt>
                  <dd>{krew.viewer_role}</dd>
                </>
              )}
            </dl>

            <div className='group-detail__actions'>
              {!krew.archived && !krew.viewer_role && (
                <button
                  type='button'
                  onClick={handleJoin}
                  disabled={busy}
                  className='group-detail__btn-primary'
                >
                  <FormattedMessage
                    id='krew.detail.join'
                    defaultMessage='Join'
                  />
                </button>
              )}

              {krew.viewer_role && !krew.archived && (
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='group-detail__btn-secondary'
                >
                  <FormattedMessage
                    id='krew.detail.leave'
                    defaultMessage='Leave'
                  />
                </button>
              )}

              {krew.viewer_role === 'seeder' && !krew.archived && (
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='group-detail__btn-danger'
                >
                  <FormattedMessage
                    id='krew.detail.archive'
                    defaultMessage='Archive'
                  />
                </button>
              )}
            </div>

            {krew.viewer_role && !krew.archived && (
              <div className='group-detail__composer'>
                <h3>
                  <FormattedMessage
                    id='krew.detail.post_here'
                    defaultMessage='Post to this krew'
                  />
                </h3>
                <textarea
                  value={composerText}
                  onChange={handleComposerChange}
                  rows={3}
                  placeholder={intl.formatMessage({
                    id: 'krew.detail.composer_placeholder',
                    defaultMessage: "What's happening in the krew?",
                  })}
                />
                <button
                  type='button'
                  onClick={handlePost}
                  disabled={busy || !composerText.trim()}
                >
                  <FormattedMessage
                    id='krew.detail.post_send'
                    defaultMessage='Post'
                  />
                </button>
              </div>
            )}

            <h3 className='group-detail__timeline-heading'>
              <FormattedMessage
                id='krew.detail.timeline'
                defaultMessage='Krew timeline'
              />
            </h3>
            <StatusList
              scrollKey={`krew_timeline:${krew.id}`}
              statusIds={statusIds}
              isLoading={loading}
              hasMore={false}
              onLoadMore={noopLoadMore}
              timelineId={`krew_timeline:${krew.id}`}
              emptyMessage={
                <FormattedMessage
                  id='krew.detail.empty_timeline'
                  defaultMessage='No posts yet.'
                />
              }
            />
          </>
        )}
      </div>
    </Stage>
  );
};
