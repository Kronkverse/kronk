import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import api from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';

import { AudioPlayer } from './components/audio_player';
import { EditForm } from './components/edit_form';
import { Tracklist } from './components/tracklist';
import type { BoothSet } from './types';

const messages = defineMessages({
  unverified: { id: 'booth.credit.unverified', defaultMessage: 'unverified' },
  creditedYou: {
    id: 'booth.credit.you',
    defaultMessage: 'You are credited on this set.',
  },
  confirmCredit: { id: 'booth.credit.confirm', defaultMessage: 'That’s me' },
  removeCredit: { id: 'booth.credit.remove', defaultMessage: 'Take me off' },
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: { id: 'booth.not_found', defaultMessage: 'Set not found.' },
  shareLink: { id: 'booth.share_link', defaultMessage: 'Share player link' },
  copyLink: { id: 'booth.copy_link', defaultMessage: 'Copied!' },
  editSet: { id: 'booth.page_action.edit', defaultMessage: 'Edit set' },
});

const BoothSetPage: React.FC<{ multiColumn: boolean }> = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const [set, setSet] = useState<BoothSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void api()
      .get<BoothSet>(`/api/v1/booth_sets/${id}`)
      .then((res) => {
        setSet(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  // Edit lives in the Ж menu (docs/design.md): the set's owner gets an
  // Edit set moon here, opening the same form the grid card's menu does.
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);
  const handleEditSuccess = useCallback((updated: BoothSet) => {
    setSet(updated);
    setEditing(false);
  }, []);

  // You were credited on this set by its uploader: say it is you, or come
  // off it.
  const handleConfirmCredit = useCallback(() => {
    if (!id) return;
    void api()
      .post<BoothSet>(`/api/v1/booth_sets/${id}/confirm_credit`)
      .then((res) => {
        setSet(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, [id]);
  const handleRemoveCredit = useCallback(() => {
    if (!id) return;
    void api()
      .delete<BoothSet>(`/api/v1/booth_sets/${id}/credit`)
      .then((res) => {
        setSet(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, [id]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editSet),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleStartEdit,
    !!set?.is_owner && !editing,
  );

  const handleCopyLink = useCallback(() => {
    if (!set) return;
    const url = `${window.location.origin}/booth/sets/${set.id}/embed`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }, [set]);

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <div className='booth booth--set-page scrollable'>
        {/* No in-column back chip — the Frame's SpaceBadge already
            renders `[← The Booth]` at top-left for any /hub/booth/*
            sub-page. Per docs/design.md (Aesthetic system) § 4.3,
            <BackToKorner> is only for pages that need a chip pointing
            at a specific parent that differs from what SpaceBadge
            provides (e.g. an event detail pointing at the "all events"
            face). Here it just duplicated the auto SpaceBadge. */}
        {loading && (
          <div className='booth__loading'>
            {intl.formatMessage(messages.loading)}
          </div>
        )}

        {!loading && !set && (
          <div className='booth__empty'>
            {intl.formatMessage(messages.notFound)}
          </div>
        )}

        {set && editing && (
          <EditForm
            set={set}
            onSuccess={handleEditSuccess}
            onCancel={handleEditCancel}
          />
        )}

        {set && !editing && (
          <div className='booth__set-detail'>
            <div className='booth__set-detail-cover'>
              {set.cover_url ? (
                <img src={set.cover_url} alt='' />
              ) : (
                <div className='booth__set-detail-cover-placeholder'>
                  <HeadphonesIcon />
                </div>
              )}
            </div>

            <div className='booth__set-detail-meta'>
              <h1 className='booth__set-detail-title'>{set.title}</h1>
              <div className='booth__set-detail-artist'>{set.artist_name}</div>
              {/* Who that line is: the uploader, then everyone they
                  credited. A tagged account is unverified until that
                  person confirms it; a plain name is someone not on Kronk. */}
              <ul className='booth-credit-list'>
                {set.artists.map((artist) =>
                  artist.account ? (
                    <li key={artist.account.id} className='booth-credit'>
                      <Link to={`/@${artist.account.acct}`}>
                        <img src={artist.account.avatar} alt='' />@
                        {artist.account.username}
                      </Link>
                      {!artist.verified && (
                        <span className='booth-credit__flag'>
                          {intl.formatMessage(messages.unverified)}
                        </span>
                      )}
                    </li>
                  ) : (
                    <li key={artist.name} className='booth-credit'>
                      {artist.name}
                    </li>
                  ),
                )}
              </ul>
              {set.artists.some(
                (artist) => artist.account?.id === me && !artist.uploader,
              ) && (
                <div className='booth-credit-own'>
                  {set.artists.some(
                    (artist) => artist.account?.id === me && !artist.verified,
                  ) && (
                    <>
                      <span>{intl.formatMessage(messages.creditedYou)}</span>
                      <button type='button' onClick={handleConfirmCredit}>
                        {intl.formatMessage(messages.confirmCredit)}
                      </button>
                    </>
                  )}
                  <button type='button' onClick={handleRemoveCredit}>
                    {intl.formatMessage(messages.removeCredit)}
                  </button>
                </div>
              )}
              {set.event_name && (
                <div className='booth__set-detail-event'>
                  {set.event_name}
                  {set.event_date &&
                    ` · ${new Date(set.event_date).toLocaleDateString()}`}
                </div>
              )}
              {set.genres.length > 0 && (
                <span className='booth__set-detail-genre'>
                  {set.genres.join(', ')}
                </span>
              )}
              {set.description && (
                <p className='booth__set-detail-description'>
                  {set.description}
                </p>
              )}
            </div>

            <AudioPlayer set={set} />

            <Tracklist set={set} />

            <div className='booth__set-detail-actions'>
              <button
                className='booth__action-btn'
                onClick={handleCopyLink}
                type='button'
              >
                {copied
                  ? intl.formatMessage(messages.copyLink)
                  : intl.formatMessage(messages.shareLink)}
              </button>
            </div>
          </div>
        )}
      </div>

      <Helmet>
        <title>
          {set
            ? `${set.title} — The Booth`
            : intl.formatMessage(messages.heading)}
        </title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothSetPage;
