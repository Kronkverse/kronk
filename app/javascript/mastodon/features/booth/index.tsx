import { useRef, useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useIdentity } from 'mastodon/identity_context';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { AudioPlayer } from './components/audio_player';
import { BoothSetCard } from './components/booth_set_card';
import { UploadForm } from './components/upload_form';
import type { BoothSet } from './types';

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  empty: { id: 'booth.empty', defaultMessage: 'No sets yet. Be the first to upload!' },
  uploadSet: { id: 'booth.upload_set', defaultMessage: 'Upload set' },
  shareLink: { id: 'booth.share_link', defaultMessage: 'Share player link' },
  copyLink: { id: 'booth.copy_link', defaultMessage: 'Copied!' },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  filterArtist: { id: 'booth.filter_artist', defaultMessage: 'Artist' },
  filterGenre: { id: 'booth.filter_genre', defaultMessage: 'Genre' },
  filterEvent: { id: 'booth.filter_event', defaultMessage: 'Event' },
});

const Booth: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);
  const { signedIn } = useIdentity();

  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSet, setActiveSet] = useState<BoothSet | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [filterArtist, setFilterArtist] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  useEffect(() => {
    void api()
      .get<BoothSet[]>('/api/v1/booth_sets')
      .then((res) => {
        setSets(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = useCallback((set: BoothSet) => {
    setActiveSet((prev) => (prev?.id === set.id ? null : set));
    setShowUpload(false);
  }, []);

  const handleUploadSuccess = useCallback((set: BoothSet) => {
    setSets((prev) => [set, ...prev]);
    setActiveSet(set);
    setShowUpload(false);
  }, []);

  const handleCopyLink = useCallback((set: BoothSet, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/booth/sets/${set.id}/embed`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(set.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const filteredSets = sets.filter((set) => {
    if (filterArtist && !set.artist_name.toLowerCase().includes(filterArtist.toLowerCase())) return false;
    if (filterGenre && (!set.genre || !set.genre.toLowerCase().includes(filterGenre.toLowerCase()))) return false;
    if (filterEvent && (!set.event_name || !set.event_name.toLowerCase().includes(filterEvent.toLowerCase()))) return false;
    if (filterDate && set.event_date !== filterDate) return false;
    return true;
  });

  return (
    <Column bindToDocument={!multiColumn} ref={columnRef} label={intl.formatMessage(messages.heading)}>
      <ColumnHeader
        title={planetName('Booth')}
        icon='headphones'
        iconComponent={planetIcon('Booth')}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div
        className='booth scrollable'
        style={{ '--space-color': spaceColor('Booth') } as React.CSSProperties}
      >
        {signedIn && !showUpload && (
          <button
            className='booth__upload-btn'
            onClick={() => {
              setShowUpload(true);
              setActiveSet(null);
            }}
            type='button'
          >
            <AddIcon />
            {intl.formatMessage(messages.uploadSet)}
          </button>
        )}

        {showUpload && (
          <UploadForm
            onSuccess={handleUploadSuccess}
            onCancel={() => setShowUpload(false)}
          />
        )}

        {!showUpload && (
          <div className='booth__filters'>
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterArtist)}
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
            />
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterGenre)}
              value={filterGenre}
              onChange={(e) => setFilterGenre(e.target.value)}
            />
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterEvent)}
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
            />
            <input
              className='booth__filter-input booth__filter-input--date'
              type='date'
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
        )}

        {activeSet && (
          <div className='booth__now-playing'>
            <div className='booth__now-playing-cover'>
              {activeSet.cover_url ? (
                <img src={activeSet.cover_url} alt='' />
              ) : (
                <div className='booth__now-playing-cover-placeholder'>
                  <HeadphonesIcon />
                </div>
              )}
            </div>

            <div className='booth__now-playing-info'>
              <div className='booth__now-playing-title'>{activeSet.title}</div>
              <div className='booth__now-playing-artist'>{activeSet.artist_name}</div>
              {activeSet.event_name && (
                <div className='booth__now-playing-event'>{activeSet.event_name}</div>
              )}
            </div>

            <AudioPlayer set={activeSet} />

            <div className='booth__now-playing-actions'>
              <button
                className='booth__action-btn'
                onClick={(e) => handleCopyLink(activeSet, e)}
                type='button'
                title={intl.formatMessage(messages.shareLink)}
              >
                {copiedId === activeSet.id
                  ? intl.formatMessage(messages.copyLink)
                  : intl.formatMessage(messages.shareLink)}
              </button>
            </div>
          </div>
        )}

        <div className='booth__list'>
          {loading && (
            <div className='booth__loading'>{intl.formatMessage(messages.loading)}</div>
          )}
          {!loading && filteredSets.length === 0 && (
            <div className='booth__empty'>{intl.formatMessage(messages.empty)}</div>
          )}
          {filteredSets.map((set) => (
            <BoothSetCard
              key={set.id}
              set={set}
              onSelect={handleSelect}
              active={activeSet?.id === set.id}
            />
          ))}
        </div>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Booth;
