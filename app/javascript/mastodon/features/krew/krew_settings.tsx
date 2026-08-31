import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useParams } from 'react-router-dom';

import {
  apiGetKrew,
  apiDetachKorner,
  apiArchiveKrew,
  apiRegenerateInvite,
} from 'mastodon/api/krew';
import type { ApiKrewJSON, KrewKornerSlug } from 'mastodon/api/krew';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { Stage } from 'mastodon/components/stage';

// Krew Settings space (/hub/krew/:id/settings) — the management surface
// split out of the detail page (Tal 2026-08-31): the invite link, space
// removal, and archive live here so the Krew page itself stays about
// identity + who's in it + where to go.

const messages = defineMessages({
  title: { id: 'krew.settings.title', defaultMessage: 'Krew settings' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  seederNote: {
    id: 'krew.detail.seeder_note',
    defaultMessage:
      "The seeder gathers the Krew and can't remove members. Membership is voluntary.",
  },
  invite: { id: 'krew.detail.invite_heading', defaultMessage: 'Invite link' },
  inviteHint: {
    id: 'krew.detail.invite_hint',
    defaultMessage:
      'Share this link to let people join. Regenerating invalidates the old link.',
  },
  copy: { id: 'krew.detail.invite_copy', defaultMessage: 'Copy' },
  copied: { id: 'krew.detail.invite_copied', defaultMessage: 'Copied' },
  regenerate: {
    id: 'krew.detail.invite_regenerate',
    defaultMessage: 'Regenerate',
  },
  regenerateConfirm: {
    id: 'krew.detail.invite_regenerate_confirm',
    defaultMessage:
      'Regenerate the invite link? Any link you shared with the old token will stop working.',
  },
  spaces: { id: 'krew.settings.spaces', defaultMessage: 'Spaces' },
  spacesHint: {
    id: 'krew.settings.spaces_hint',
    defaultMessage: 'Remove a space to turn it off for this Krew.',
  },
  remove: { id: 'krew.settings.remove_space', defaultMessage: 'Remove' },
  danger: { id: 'krew.settings.danger', defaultMessage: 'Archive' },
  archive: { id: 'krew.detail.archive', defaultMessage: 'Archive this Krew' },
  archiveHint: {
    id: 'krew.settings.archive_hint',
    defaultMessage:
      'Existing posts stay resolvable; new activity is blocked. This cannot be undone.',
  },
  archiveConfirm: {
    id: 'krew.detail.archive_confirm',
    defaultMessage:
      'Archive this krew? Existing posts stay resolvable; new activity is blocked.',
  },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },
});

const SpaceRow: React.FC<{
  slug: KrewKornerSlug;
  onRemove: (slug: KrewKornerSlug) => void;
  disabled: boolean;
}> = ({ slug, onRemove, disabled }) => {
  const intl = useIntl();
  const handle = useCallback(() => {
    onRemove(slug);
  }, [slug, onRemove]);
  return (
    <li className='krew-settings__space-row'>
      <KornerGlyph
        slug={slug}
        className='krew-settings__space-glyph'
        aria-hidden='true'
      />
      <span className='krew-settings__space-name'>{slug}</span>
      <button
        type='button'
        onClick={handle}
        disabled={disabled}
        className='krew-detail__btn krew-detail__btn--ghost'
      >
        {intl.formatMessage(messages.remove)}
      </button>
    </li>
  );
};

export const KrewSettings = () => {
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
      setKrew(await apiGetKrew(id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleRemove = useCallback(
    (slug: KrewKornerSlug) => {
      if (!id) return;
      setBusy(true);
      apiDetachKorner(id, slug)
        .then(refetch)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, refetch],
  );

  const handleRegenerate = useCallback(() => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.regenerateConfirm))) return;
    setBusy(true);
    apiRegenerateInvite(id)
      .then(refetch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, intl, refetch]);

  const handleArchive = useCallback(() => {
    if (!id) return;
    if (!window.confirm(intl.formatMessage(messages.archiveConfirm))) return;
    setBusy(true);
    apiArchiveKrew(id)
      .then(refetch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, intl, refetch]);

  const inviteUrl =
    krew?.invite_token && krew.slug
      ? `${window.location.origin}/hub/krew/${krew.slug}?k=${encodeURIComponent(krew.invite_token)}`
      : null;

  const handleCopy = useCallback(() => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, [inviteUrl]);

  const isSeeder = krew?.viewer_role === 'seeder';

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable krew-settings'>
        {error && <p className='krew-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='krew-detail__loading'>
            <FormattedMessage {...messages.loading} />
          </p>
        )}

        {krew && (
          <>
            <h1 className='krew-settings__title'>
              {krew.name}
              {krew.archived && (
                <span className='krew-detail__archived-badge'>
                  <FormattedMessage {...messages.archived} />
                </span>
              )}
            </h1>

            <p className='krew-detail__seeder-note'>
              <FormattedMessage {...messages.seederNote} />
            </p>

            {inviteUrl && !krew.archived && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.invite} />
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
                    aria-label={intl.formatMessage(messages.invite)}
                  />
                  <button
                    type='button'
                    onClick={handleCopy}
                    className='krew-detail__btn krew-detail__btn--secondary'
                  >
                    {copied
                      ? intl.formatMessage(messages.copied)
                      : intl.formatMessage(messages.copy)}
                  </button>
                  <button
                    type='button'
                    onClick={handleRegenerate}
                    disabled={busy}
                    className='krew-detail__btn krew-detail__btn--ghost'
                  >
                    <FormattedMessage {...messages.regenerate} />
                  </button>
                </div>
              </section>
            )}

            {isSeeder && krew.korners.length > 0 && (
              <section className='krew-settings__section'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.spaces} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.spacesHint} />
                </p>
                <ul className='krew-settings__space-list'>
                  {krew.korners.map((slug) => (
                    <SpaceRow
                      key={slug}
                      slug={slug}
                      onRemove={handleRemove}
                      disabled={busy}
                    />
                  ))}
                </ul>
              </section>
            )}

            {isSeeder && !krew.archived && (
              <section className='krew-settings__section krew-settings__section--danger'>
                <h3 className='krew-detail__section-heading'>
                  <FormattedMessage {...messages.danger} />
                </h3>
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.archiveHint} />
                </p>
                <button
                  type='button'
                  onClick={handleArchive}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--danger'
                >
                  <FormattedMessage {...messages.archive} />
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </Stage>
  );
};
