import { useRef, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';

import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

import { AudioPlayer } from './components/audio_player';
import type { BoothSet } from './types';

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  back: { id: 'booth.back', defaultMessage: 'Back to The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: { id: 'booth.not_found', defaultMessage: 'Set not found.' },
  shareLink: { id: 'booth.share_link', defaultMessage: 'Share player link' },
  copyLink: { id: 'booth.copy_link', defaultMessage: 'Copied!' },
});

const BoothSetPage: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const korner = useKorner('booth');
  const kornerIcon = useKornerIcon('booth');
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);
  const { id } = useParams<{ id: string }>();
  const [set, setSet] = useState<BoothSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

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
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        title={korner?.name ?? 'Booth'}
        icon='headphones'
        iconComponent={kornerIcon}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div className='booth booth--set-page scrollable'>
        <Link to='/hub/booth' className='booth__back-link'>
          ← {intl.formatMessage(messages.back)}
        </Link>

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
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothSetPage;
