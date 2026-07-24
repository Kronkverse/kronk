import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams } from 'react-router-dom';

import {
  apiGetKrew,
  apiJoinKrew,
  apiLeaveKrew,
  apiArchiveKrew,
  apiRegenerateInvite,
} from 'mastodon/api/krew';
import type { ApiKrewJSON, KrewKornerSlug } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Krew page (/hub/krew/:slug) — a metadata card, not a stream (§7.2).
// Redesigned 2026-07-24 alongside the landing so the two surfaces
// read as one system. Classnames moved into the `.krew-detail__*`
// namespace.

const messages = defineMessages({
  title: { id: 'krew.detail.title', defaultMessage: 'Krew' },
  back: { id: 'krew.detail.back', defaultMessage: '← Back to Krews' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  members: {
    id: 'krew.members_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },
  join: { id: 'krew.detail.join', defaultMessage: 'Join' },
  leave: { id: 'krew.detail.leave', defaultMessage: 'Leave' },
  archive: { id: 'krew.detail.archive', defaultMessage: 'Archive' },
  seededBy: {
    id: 'krew.detail.seeded_by',
    defaultMessage: 'Seeded by account #{accountId}',
  },
  seederNote: {
    id: 'krew.detail.seeder_note',
    defaultMessage:
      "The seeder gathers the Krew and can't remove members. Membership is voluntary.",
  },
  inviteHeading: {
    id: 'krew.detail.invite_heading',
    defaultMessage: 'Invite link',
  },
  inviteHint: {
    id: 'krew.detail.invite_hint',
    defaultMessage:
      'Share this link to let people join. Regenerating invalidates the old link.',
  },
  copyLink: { id: 'krew.detail.invite_copy', defaultMessage: 'Copy' },
  copied: { id: 'krew.detail.invite_copied', defaultMessage: 'Copied' },
  regenerateLink: {
    id: 'krew.detail.invite_regenerate',
    defaultMessage: 'Regenerate',
  },
  regenerateConfirm: {
    id: 'krew.detail.invite_regenerate_confirm',
    defaultMessage:
      'Regenerate the invite link? Any link you shared with the old token will stop working.',
  },
  kornersHeading: {
    id: 'krew.detail.korners_heading',
    defaultMessage: 'Accreted Korners',
  },
  kornersEmpty: {
    id: 'krew.detail.korners_empty',
    defaultMessage: "This Krew hasn't accreted any Korners yet.",
  },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },
  archiveConfirm: {
    id: 'krew.detail.archive_confirm',
    defaultMessage:
      'Archive this krew? Existing posts stay resolvable; new activity is blocked.',
  },
  noFeedNote: {
    id: 'krew.detail.no_feed',
    defaultMessage:
      'No feed here. Posts scoped to this Krew appear in your Home timeline; the conversation lives in Nudges.',
  },
  inviteOnly: {
    id: 'krew.marker.invite_only',
    defaultMessage: 'Invite-only',
  },
  metaAccess: { id: 'krew.detail.meta_access', defaultMessage: 'Access' },
  metaRole: { id: 'krew.detail.meta_role', defaultMessage: 'Your role' },
});

const initial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

const KornerChips: React.FC<{ korners: KrewKornerSlug[] }> = ({ korners }) => {
  if (korners.length === 0) return null;
  return (
    <ul className='krew-detail__korner-chips'>
      {korners.map((slug) => (
        <li key={slug} className='krew-detail__korner-chip'>
          <Link to={`/hub/${slug}`}>{slug}</Link>
        </li>
      ))}
    </ul>
  );
};

export const KrewDetail = () => {
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const [krew, setKrew] = useState<ApiKrewJSON | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const k = await apiGetKrew(id);
      setKrew(k);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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
    if (!window.confirm(intl.formatMessage(messages.archiveConfirm))) return;
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
  }, [id, intl]);

  const doRegenerate = useCallback(async () => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.regenerateConfirm))) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiRegenerateInvite(id);
      setKrew(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [id, intl]);

  const handleJoin = useCallback(() => {
    void doJoin();
  }, [doJoin]);
  const handleLeave = useCallback(() => {
    void doLeave();
  }, [doLeave]);
  const handleArchive = useCallback(() => {
    void doArchive();
  }, [doArchive]);
  const handleRegenerate = useCallback(() => {
    void doRegenerate();
  }, [doRegenerate]);

  const inviteUrl = krew?.invite_token
    ? `${window.location.origin}/hub/krew/${krew.slug}?k=${encodeURIComponent(krew.invite_token)}`
    : null;

  const handleCopyInvite = useCallback(() => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, [inviteUrl]);

  return (
    <Stage label={krew?.name ?? intl.formatMessage(messages.title)}>
      <div className='scrollable krew-detail'>
        <Link to='/hub/krew' className='krew-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>

        {error && <p className='krew-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='krew-detail__loading'>
            <FormattedMessage {...messages.loading} />
          </p>
        )}

        {krew && (
          <>
            <header className='krew-detail__header'>
              <span
                className='krew-detail__avatar'
                aria-hidden='true'
                data-initial={initial(krew.name)}
              >
                {initial(krew.name)}
              </span>
              <div className='krew-detail__identity'>
                <h1 className='krew-detail__name'>
                  {krew.name}
                  {krew.access === 'invite_only' && (
                    <span
                      className='krew-detail__marker'
                      aria-label={intl.formatMessage(messages.inviteOnly)}
                      title={intl.formatMessage(messages.inviteOnly)}
                    >
                      ⚿
                    </span>
                  )}
                </h1>
                <div className='krew-detail__submeta'>
                  <span className='krew-detail__slug'>@{krew.slug}</span>
                  {krew.archived && (
                    <span className='krew-detail__archived-badge'>
                      <FormattedMessage {...messages.archived} />
                    </span>
                  )}
                </div>
              </div>
            </header>

            {krew.description && (
              <p className='krew-detail__description'>{krew.description}</p>
            )}

            <dl className='krew-detail__meta'>
              <div className='krew-detail__meta-item'>
                <dt>
                  <FormattedMessage
                    {...messages.members}
                    values={{ count: krew.member_count }}
                  />
                </dt>
                <dd>{krew.member_count}</dd>
              </div>
              <div className='krew-detail__meta-item'>
                <dt>
                  <FormattedMessage {...messages.metaAccess} />
                </dt>
                <dd>{krew.access.replace('_', ' ')}</dd>
              </div>
              {krew.seeded_by_account_id && (
                <div className='krew-detail__meta-item'>
                  <dt>
                    <FormattedMessage {...messages.metaRole} />
                  </dt>
                  <dd>{krew.viewer_role ?? '—'}</dd>
                </div>
              )}
            </dl>

            <p className='krew-detail__seeder-note'>
              <FormattedMessage {...messages.seederNote} />
            </p>

            <div className='krew-detail__actions'>
              {!krew.archived && !krew.viewer_role && (
                <button
                  type='button'
                  onClick={handleJoin}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--primary'
                >
                  <FormattedMessage {...messages.join} />
                </button>
              )}

              {krew.viewer_role && !krew.archived && (
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--secondary'
                >
                  <FormattedMessage {...messages.leave} />
                </button>
              )}

              {krew.viewer_role === 'seeder' && !krew.archived && (
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--danger'
                >
                  <FormattedMessage {...messages.archive} />
                </button>
              )}
            </div>

            {inviteUrl && !krew.archived && (
              <section className='krew-detail__invite'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.inviteHeading} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.inviteHint} />
                </p>
                <div className='krew-detail__invite-row'>
                  <input
                    type='text'
                    readOnly
                    value={inviteUrl}
                    className='krew-detail__invite-input'
                    aria-label={intl.formatMessage(messages.inviteHeading)}
                  />
                  <button
                    type='button'
                    onClick={handleCopyInvite}
                    className='krew-detail__btn krew-detail__btn--secondary'
                  >
                    {copied
                      ? intl.formatMessage(messages.copied)
                      : intl.formatMessage(messages.copyLink)}
                  </button>
                  <button
                    type='button'
                    onClick={handleRegenerate}
                    disabled={busy}
                    className='krew-detail__btn krew-detail__btn--ghost'
                  >
                    <FormattedMessage {...messages.regenerateLink} />
                  </button>
                </div>
              </section>
            )}

            <section className='krew-detail__korners'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.kornersHeading} />
              </h3>
              {krew.korners.length === 0 ? (
                <p className='krew-detail__korners-empty'>
                  <FormattedMessage {...messages.kornersEmpty} />
                </p>
              ) : (
                <KornerChips korners={krew.korners} />
              )}
            </section>

            <p className='krew-detail__no-feed'>
              <FormattedMessage {...messages.noFeedNote} />
            </p>
          </>
        )}
      </div>
    </Stage>
  );
};
