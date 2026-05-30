import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useIdentity } from 'mastodon/identity_context';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { BoothSetCard } from './components/booth_set_card';
import { EditForm } from './components/edit_form';
import {
  InlinePlayer,
  type InlinePlayerHandle,
} from './components/inline_player';
import { UploadForm } from './components/upload_form';
import type { BoothSet } from './types';

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  empty: {
    id: 'booth.empty',
    defaultMessage: 'No sets yet. Be the first to upload!',
  },
  uploadSet: { id: 'booth.upload_set', defaultMessage: 'Upload set' },
  loading: { id: 'booth.loading', defaultMessage: 'Loading sets…' },
  filterArtist: { id: 'booth.filter_artist', defaultMessage: 'Artist' },
  filterGenre: { id: 'booth.filter_genre', defaultMessage: 'Genre' },
  filterEvent: { id: 'booth.filter_event', defaultMessage: 'Event' },
});

const Booth: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);
  const { signedIn } = useIdentity();
  const playerRef = useRef<InlinePlayerHandle>(null);

  const [sets, setSets] = useState<BoothSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSet, setActiveSet] = useState<BoothSet | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingSet, setEditingSet] = useState<BoothSet | null>(null);
  const [showUpload, setShowUpload] = useState(false);

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

  const handlePlay = useCallback((set: BoothSet) => {
    setActiveSet((prev) => {
      if (prev?.id === set.id) {
        // Already active — just re-expand
        setExpanded(true);
        return prev;
      }
      setExpanded(true);
      setIsPlaying(false);
      return set;
    });
    setEditingSet(null);
    setShowUpload(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    playerRef.current?.togglePlayPause();
  }, []);

  const handleEdit = useCallback((set: BoothSet) => {
    setEditingSet(set);
    setShowUpload(false);
  }, []);

  const handleEditSuccess = useCallback((updated: BoothSet) => {
    setSets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSet(null);
    setActiveSet((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handleUploadSuccess = useCallback((set: BoothSet) => {
    setSets((prev) => [set, ...prev]);
    setActiveSet(set);
    setExpanded(true);
    setShowUpload(false);
  }, []);

  const filteredSets = sets.filter((set) => {
    if (
      filterArtist &&
      !set.artist_name.toLowerCase().includes(filterArtist.toLowerCase())
    )
      return false;
    if (
      filterGenre &&
      !set.genres.some((g) =>
        g.toLowerCase().includes(filterGenre.toLowerCase()),
      )
    )
      return false;
    if (
      filterEvent &&
      (!set.event_name ||
        !set.event_name.toLowerCase().includes(filterEvent.toLowerCase()))
    )
      return false;
    if (filterDate && set.event_date !== filterDate) return false;
    return true;
  });

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
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
        {signedIn && !showUpload && !editingSet && (
          <button
            className='booth__upload-btn'
            onClick={() => setShowUpload(true)}
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

        {editingSet && (
          <EditForm
            set={editingSet}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditingSet(null)}
          />
        )}

        {!showUpload && !editingSet && (
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

        <div className='booth__list'>
          {loading && (
            <div className='booth__loading'>
              {intl.formatMessage(messages.loading)}
            </div>
          )}
          {!loading && filteredSets.length === 0 && (
            <div className='booth__empty'>
              {intl.formatMessage(messages.empty)}
            </div>
          )}
          {filteredSets.map((set) => (
            <Fragment key={set.id}>
              {/* Hide the card while its player is expanded */}
              {!(activeSet?.id === set.id && expanded) && (
                <BoothSetCard
                  set={set}
                  onPlay={handlePlay}
                  onTogglePlay={handleTogglePlay}
                  onEdit={handleEdit}
                  active={activeSet?.id === set.id}
                  playing={isPlaying && activeSet?.id === set.id}
                />
              )}
              {activeSet?.id === set.id && (
                <InlinePlayer
                  ref={playerRef}
                  set={activeSet}
                  hidden={!expanded}
                  onCollapse={() => setExpanded(false)}
                  onPlayingChange={setIsPlaying}
                />
              )}
            </Fragment>
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
