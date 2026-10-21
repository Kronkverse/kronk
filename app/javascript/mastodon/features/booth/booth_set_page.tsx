import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useLocation, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { AudioPlayer } from './components/audio_player';
import { EditForm } from './components/edit_form';
import { ShareForm } from './components/share_form';
import { Tracklist } from './components/tracklist';
import { formatDuration } from './format';
import type { BoothSet } from './types';

// A set's page, on the shared detail shell (`<KornerDetail>`): cover,
// title, who made it, the facts line, then the player, the people
// credited, the notes and the track list.
//
// A set fresh out of the composer that was not posted to the feed
// arrives with `state.justUploaded`, and the page offers the share
// once, as a banner. Edit is the Ж menu's (owner only); sharing and
// the player link are the page's own actions.

interface LocationState {
  justUploaded?: boolean;
}

const messages = defineMessages({
  unverified: { id: 'booth.credit.unverified', defaultMessage: 'unverified' },
  creditedYou: {
    id: 'booth.credit.you',
    defaultMessage: 'You are credited on this set.',
  },
  confirmCredit: { id: 'booth.credit.confirm', defaultMessage: 'That’s me' },
  removeCredit: { id: 'booth.credit.remove', defaultMessage: 'Take me off' },
  creditsHeading: { id: 'booth.credit.heading', defaultMessage: 'Who played' },
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: { id: 'booth.not_found', defaultMessage: 'Set not found.' },
  notFoundBody: {
    id: 'booth.not_found_body',
    defaultMessage: 'It may have been taken down by the person who shared it.',
  },
  shareLink: { id: 'booth.share_link', defaultMessage: 'Copy player link' },
  copied: { id: 'booth.copy_link', defaultMessage: 'Player link copied' },
  shareToFeed: { id: 'booth.share_to_feed', defaultMessage: 'Share to feed' },
  shared: { id: 'booth.shared', defaultMessage: 'Shared to your feed' },
  editSet: { id: 'booth.page_action.edit', defaultMessage: 'Edit set' },
  draft: {
    id: 'booth.set_page.draft',
    defaultMessage: 'Only you can see this set',
  },
  justUploaded: {
    id: 'booth.set_page.just_uploaded',
    defaultMessage:
      'Your set is up. Members can find it in the Booth; share it to your feed so your people hear it.',
  },
});

const BoothSetPage: React.FC<{ multiColumn: boolean }> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const location = useLocation<LocationState | undefined>();
  const [set, setSet] = useState<BoothSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [offerShare, setOfferShare] = useState(
    location.state?.justUploaded === true,
  );

  // A late answer for a set you've moved away from is dropped.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setLoading(true);
    void api()
      .get<BoothSet>(`/api/v1/booth_sets/${id}`)
      .then((res) => {
        if (cancelled) return;
        setSet(res.data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  const handleStartShare = useCallback(() => {
    setSharing(true);
  }, []);
  const handleShareCancel = useCallback(() => {
    setSharing(false);
  }, []);
  const handleShareSuccess = useCallback(() => {
    setSharing(false);
    setOfferShare(false);
    dispatch(showAlert({ message: messages.shared }));
  }, [dispatch]);

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
      dispatch(showAlert({ message: messages.copied }));
      return undefined;
    });
  }, [set, dispatch]);

  if (loading || !set) {
    return (
      <Stage label={intl.formatMessage(messages.heading)}>
        <div className='stage-column'>
          {loading ? (
            <LoadingState label={intl.formatMessage(messages.loading)} />
          ) : (
            <EmptyState
              title={intl.formatMessage(messages.notFound)}
              body={intl.formatMessage(messages.notFoundBody)}
            />
          )}
        </div>
      </Stage>
    );
  }

  const isOwner = set.is_owner === true;
  const duration = formatDuration(set.duration_seconds);
  const creditedMe = set.artists.find(
    (artist) => artist.account?.id === me && !artist.uploader,
  );

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <KornerDetail
        className='booth-set'
        attached={{ korner: 'booth', id: set.id, canManage: isOwner }}
        hero={
          <div className='booth-set__cover'>
            {set.cover_url ? (
              <img
                src={set.cover_url}
                alt=''
                style={{ objectPosition: `50% ${set.cover_offset_y ?? 50}%` }}
              />
            ) : (
              <HeadphonesIcon aria-hidden='true' />
            )}
          </div>
        }
        banner={
          !set.published ? (
            <span className='booth-set__notice'>
              {intl.formatMessage(messages.draft)}
            </span>
          ) : offerShare && isOwner ? (
            <div className='booth-set__notice'>
              <span>{intl.formatMessage(messages.justUploaded)}</span>
              <KornerPill
                variant='primary'
                label={intl.formatMessage(messages.shareToFeed)}
                onClick={handleStartShare}
              />
            </div>
          ) : undefined
        }
        title={set.title}
        subtitle={set.artist_name}
        meta={
          <KornerMeta
            items={[
              set.genres.length > 0 && set.genres.join(', '),
              set.event_name &&
                (set.event_date
                  ? `${set.event_name}, ${new Date(set.event_date).toLocaleDateString()}`
                  : set.event_name),
              duration,
              <FormattedMessage
                key='plays'
                id='booth.plays'
                defaultMessage='{count, plural, one {# play} other {# plays}}'
                values={{ count: set.play_count }}
              />,
            ]}
          />
        }
        actions={
          <KornerActionBar>
            {isOwner && set.published && (
              <KornerPill
                icon={ShareIcon}
                iconId='share'
                label={intl.formatMessage(messages.shareToFeed)}
                onClick={handleStartShare}
              />
            )}
            <KornerPill
              icon={LinkIcon}
              iconId='link'
              label={intl.formatMessage(messages.shareLink)}
              onClick={handleCopyLink}
            />
          </KornerActionBar>
        }
      >
        <AudioPlayer set={set} />

        {/* Who made it: the uploader, then everyone they credited. A
            tagged account is unverified until that person confirms it; a
            plain name is someone not on Kronk. */}
        <section className='booth-set__section'>
          <h2 className='booth-set__section-title'>
            {intl.formatMessage(messages.creditsHeading)}
          </h2>
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
          {creditedMe && (
            <div className='booth-credit-own'>
              {!creditedMe.verified && (
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
        </section>

        {set.description && (
          <p className='booth-set__description'>{set.description}</p>
        )}

        <Tracklist set={set} />
      </KornerDetail>

      {editing && (
        <EditForm
          set={set}
          onSuccess={handleEditSuccess}
          onCancel={handleEditCancel}
        />
      )}
      {sharing && (
        <ShareForm
          set={set}
          onSuccess={handleShareSuccess}
          onCancel={handleShareCancel}
        />
      )}

      <Helmet>
        <title>{`${set.title} — ${intl.formatMessage(messages.heading)}`}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothSetPage;
