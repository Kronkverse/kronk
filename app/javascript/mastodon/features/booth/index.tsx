import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useIdentity } from 'mastodon/identity_context';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { BoothSetCard } from './components/booth_set_card';
import { EditForm } from './components/edit_form';
import { InlinePlayer } from './components/inline_player';
import type { InlinePlayerHandle } from './components/inline_player';
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
  const [playRequested, setPlayRequested] = useState(false);
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
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSelect = useCallback((set: BoothSet) => {
    setPlayRequested(false);
    setActiveSet((prev) => {
      if (prev?.id === set.id) {
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

  const handlePlay = useCallback((set: BoothSet) => {
    setPlayRequested(true);
    setActiveSet((prev) => {
      if (prev?.id === set.id) {
        setExpanded(true);
        playerRef.current?.togglePlayPause();
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

  const handleDelete = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
    setActiveSet((prev) => (prev?.id === id ? null : prev));
    setExpanded(false);
  }, []);

  const handleUploadSuccess = useCallback((set: BoothSet) => {
    setSets((prev) => [set, ...prev]);
    setActiveSet(set);
    setExpanded(true);
    setShowUpload(false);
  }, []);

  const handleShowUpload = useCallback(() => {
    setShowUpload(true);
  }, []);
  const handleCancelUpload = useCallback(() => {
    setShowUpload(false);
  }, []);
  const handleCancelEdit = useCallback(() => {
    setEditingSet(null);
  }, []);
  const handleFilterArtistChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterArtist(e.target.value);
    },
    [],
  );
  const handleFilterGenreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterGenre(e.target.value);
    },
    [],
  );
  const handleFilterEventChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterEvent(e.target.value);
    },
    [],
  );
  const handleFilterDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterDate(e.target.value);
    },
    [],
  );
  const handleClearDate = useCallback(() => {
    setFilterDate('');
  }, []);
  const handleCollapse = useCallback(() => {
    setExpanded(false);
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
      !set.event_name?.toLowerCase().includes(filterEvent.toLowerCase())
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
        <section className='booth__hero'>
          <h1 className='booth__hero-title'>
            {intl.formatMessage(messages.heading)}
          </h1>
        </section>

        {signedIn && !showUpload && !editingSet && (
          <button
            className='booth__upload-btn'
            onClick={handleShowUpload}
            type='button'
          >
            <AddIcon />
            {intl.formatMessage(messages.uploadSet)}
          </button>
        )}

        {showUpload && (
          <UploadForm
            onSuccess={handleUploadSuccess}
            onCancel={handleCancelUpload}
          />
        )}

        {editingSet && (
          <EditForm
            set={editingSet}
            onSuccess={handleEditSuccess}
            onCancel={handleCancelEdit}
          />
        )}

        {!showUpload && !editingSet && (
          <div className='booth__filters'>
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterArtist)}
              value={filterArtist}
              onChange={handleFilterArtistChange}
            />
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterGenre)}
              value={filterGenre}
              onChange={handleFilterGenreChange}
            />
            <input
              className='booth__filter-input'
              type='text'
              placeholder={intl.formatMessage(messages.filterEvent)}
              value={filterEvent}
              onChange={handleFilterEventChange}
            />
            <div className='booth__filter-date-wrap'>
              <input
                className='booth__filter-input booth__filter-input--date'
                type='date'
                value={filterDate}
                onChange={handleFilterDateChange}
              />
              {filterDate && (
                <button
                  className='booth__filter-date-clear'
                  onClick={handleClearDate}
                  aria-label='Clear date filter'
                  type='button'
                >
                  <CloseIcon />
                </button>
              )}
            </div>
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
                  onSelect={handleSelect}
                  onPlay={handlePlay}
                  onTogglePlay={handleTogglePlay}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  active={activeSet?.id === set.id}
                  playing={isPlaying && activeSet?.id === set.id}
                />
              )}
              {activeSet?.id === set.id && (
                <InlinePlayer
                  ref={playerRef}
                  set={activeSet}
                  hidden={!expanded}
                  autoPlay={playRequested}
                  onCollapse={handleCollapse}
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
