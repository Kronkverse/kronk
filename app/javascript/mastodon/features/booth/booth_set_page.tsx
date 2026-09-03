import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import api from 'mastodon/api';
import { Stage } from 'mastodon/components/stage';

import { AudioPlayer } from './components/audio_player';
import type { BoothSet } from './types';

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: { id: 'booth.not_found', defaultMessage: 'Set not found.' },
  shareLink: { id: 'booth.share_link', defaultMessage: 'Share player link' },
  copyLink: { id: 'booth.copy_link', defaultMessage: 'Copied!' },
});

const BoothSetPage: React.FC<{ multiColumn: boolean }> = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const [set, setSet] = useState<BoothSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
            sub-page. Per docs/kronk_aesthetic_system.md § 4.3,
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

        {set && (
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
