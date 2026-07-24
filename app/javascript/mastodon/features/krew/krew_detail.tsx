import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams } from 'react-router-dom';

import {
  apiGetKrew,
  apiJoinKrew,
  apiLeaveKrew,
  apiArchiveKrew,
} from 'mastodon/api/krew';
import type { ApiKrewJSON, KrewKornerSlug } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Krew page (/hub/krew/:slug) — a metadata card, not a stream. Per
// KRONK_KREWS §7.2: no post feed here; the conversation lives in
// Nudges. This surface carries identity, membership actions, the
// invite-link affordance (seeder only), Korner attachments, and a
// pointer back to the Nudges thread once wired.

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
      "The seeder plants the Krew and can't remove members. Membership is voluntary.",
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
  copyLink: { id: 'krew.detail.invite_copy', defaultMessage: 'Copy link' },
  copied: { id: 'krew.detail.invite_copied', defaultMessage: 'Copied' },
  kornersHeading: {
    id: 'krew.detail.korners_heading',
    defaultMessage: 'Accreted Korners',
  },
  kornersEmpty: {
    id: 'krew.detail.korners_empty',
    defaultMessage: 'This Krew hasn’t accreted any Korners yet.',
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
      'No feed here. Posts scoped to this Krew show up in your Home timeline; the conversation lives in Nudges.',
  },
});

const initial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

const KornerChips: React.FC<{ korners: KrewKornerSlug[] }> = ({ korners }) => {
  if (korners.length === 0) return null;
  return (
    <ul className='groups-page__korner-chips'>
      {korners.map((slug) => (
        <li key={slug} className='groups-page__korner-chip'>
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

  const handleJoin = useCallback(() => {
    void doJoin();
  }, [doJoin]);
  const handleLeave = useCallback(() => {
    void doLeave();
  }, [doLeave]);
  const handleArchive = useCallback(() => {
    void doArchive();
  }, [doArchive]);

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
      <div className='scrollable group-detail'>
        <Link to='/hub/krew' className='group-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>

        {error && <p className='group-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='group-detail__loading'>
            {intl.formatMessage(messages.loading)}
          </p>
        )}

        {krew && (
          <>
            <header className='group-detail__header'>
              <span
                className='groups-page__row-avatar'
                aria-hidden='true'
                data-initial={initial(krew.name)}
              >
                {initial(krew.name)}
              </span>
              <div>
                <h1 className='group-detail__name'>
                  {krew.name}
                  {krew.access === 'invite_only' && (
                    <span
                      className='group-detail__marker'
                      aria-label='Invite-only'
                    >
                      {' '}
                      ⚿
                    </span>
                  )}
                </h1>
                <small className='group-detail__slug'>@{krew.slug}</small>
                {krew.archived && (
                  <span className='group-detail__archived-badge'>
                    {intl.formatMessage(messages.archived)}
                  </span>
                )}
              </div>
            </header>

            {krew.description && (
              <p className='group-detail__description'>{krew.description}</p>
            )}

            <dl className='group-detail__meta'>
              <dt>
                <FormattedMessage
                  {...messages.members}
                  values={{ count: krew.member_count }}
                />
              </dt>
              <dd />
              <dt>Access</dt>
              <dd>{krew.access}</dd>
              {krew.seeded_by_account_id && (
                <>
                  <dt>Seeder</dt>
                  <dd>
                    <FormattedMessage
                      {...messages.seededBy}
                      values={{ accountId: krew.seeded_by_account_id }}
                    />
                  </dd>
                </>
              )}
              {krew.viewer_role && (
                <>
                  <dt>Your role</dt>
                  <dd>{krew.viewer_role}</dd>
                </>
              )}
            </dl>

            <p className='group-detail__seeder-note'>
              {intl.formatMessage(messages.seederNote)}
            </p>

            <div className='group-detail__actions'>
              {!krew.archived && !krew.viewer_role && (
                <button
                  type='button'
                  onClick={handleJoin}
                  disabled={busy}
                  className='group-detail__btn-primary'
                >
                  {intl.formatMessage(messages.join)}
                </button>
              )}

              {krew.viewer_role && !krew.archived && (
                <button
                  type='button'
                  onClick={handleLeave}
                  disabled={busy}
                  className='group-detail__btn-secondary'
                >
                  {intl.formatMessage(messages.leave)}
                </button>
              )}

              {krew.viewer_role === 'seeder' && !krew.archived && (
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='group-detail__btn-danger'
                >
                  {intl.formatMessage(messages.archive)}
                </button>
              )}
            </div>

            {inviteUrl && !krew.archived && (
              <section className='group-detail__invite'>
                <h3>{intl.formatMessage(messages.inviteHeading)}</h3>
                <p className='group-detail__invite-hint'>
                  {intl.formatMessage(messages.inviteHint)}
                </p>
                <div className='group-detail__invite-row'>
                  <input
                    type='text'
                    readOnly
                    value={inviteUrl}
                    className='group-detail__invite-input'
                  />
                  <button
                    type='button'
                    onClick={handleCopyInvite}
                    className='group-detail__btn-secondary'
                  >
                    {copied
                      ? intl.formatMessage(messages.copied)
                      : intl.formatMessage(messages.copyLink)}
                  </button>
                </div>
              </section>
            )}

            <section className='group-detail__korners'>
              <h3>{intl.formatMessage(messages.kornersHeading)}</h3>
              {krew.korners.length === 0 ? (
                <p>{intl.formatMessage(messages.kornersEmpty)}</p>
              ) : (
                <KornerChips korners={krew.korners} />
              )}
            </section>

            <p className='group-detail__note'>
              {intl.formatMessage(messages.noFeedNote)}
            </p>
          </>
        )}
      </div>
    </Stage>
  );
};
