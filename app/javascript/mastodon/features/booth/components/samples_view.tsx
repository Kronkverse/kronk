import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { me } from 'mastodon/initial_state';

import { SAMPLE_TYPES, sampleTypeName } from '../samples';
import type { BoothSample, BoothSamplePack, BoothSampleType } from '../types';

import { SampleCard, SamplePackCard } from './sample_card';

// Samples (docs/spaces/booth.md, Samples): loops, vocals, beats, one-shots
// and stems shared for others to make things with. Packs first, as a row,
// then every sample, newest first, narrowed by type, by a search or to your
// own.

const PAGE_SIZE = 40;

const messages = defineMessages({
  loading: { id: 'booth.samples.loading', defaultMessage: 'Loading samples…' },
  empty: { id: 'booth.samples.empty', defaultMessage: 'No samples yet' },
  emptyBody: {
    id: 'booth.samples.empty_body',
    defaultMessage:
      'Share a loop, a vocal, a beat, a one-shot or a stem for others to make something with. Up to two minutes each.',
  },
  noMatch: {
    id: 'booth.samples.no_match',
    defaultMessage: 'Nothing matches that',
  },
  share: { id: 'booth.samples.share', defaultMessage: 'Share a sample' },
  search: {
    id: 'booth.samples.search',
    defaultMessage: 'Search samples or genres',
  },
  clearSearch: { id: 'booth.search_clear', defaultMessage: 'Clear search' },
  all: { id: 'booth.samples.all', defaultMessage: 'All' },
  yours: { id: 'booth.samples.yours', defaultMessage: 'Yours' },
  packs: { id: 'booth.samples.packs', defaultMessage: 'Packs' },
  pack: { id: 'booth.samples.pack', defaultMessage: 'Pack' },
  packCount: {
    id: 'booth.samples.pack_count',
    defaultMessage: '{count, plural, one {# sample} other {# samples}}',
  },
  loadMore: {
    id: 'booth.samples.load_more',
    defaultMessage: 'Load more samples',
  },
});

type Filter = BoothSampleType | 'all' | 'yours';

const FilterPill: React.FC<{
  value: Filter;
  label: string;
  chosen: Filter;
  onChoose: (value: Filter) => void;
}> = ({ value, label, chosen, onChoose }) => {
  const handleClick = useCallback(() => {
    onChoose(value);
  }, [onChoose, value]);
  return (
    <KornerPill label={label} active={chosen === value} onClick={handleClick} />
  );
};

export const SamplesView: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [samples, setSamples] = useState<BoothSample[]>([]);
  const [packs, setPacks] = useState<BoothSamplePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // A page that comes back for an earlier search is dropped.
  const search = useRef(0);
  const filtering = query !== '' || filter !== 'all';

  const fetchPage = useCallback(
    (maxId?: string) =>
      api().get<BoothSample[]>('/api/v1/booth_samples', {
        params: {
          q: query || undefined,
          type: filter === 'all' || filter === 'yours' ? undefined : filter,
          account_id: filter === 'yours' ? me : undefined,
          max_id: maxId,
        },
      }),
    [query, filter],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input.trim());
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  useEffect(() => {
    const current = ++search.current;
    setLoading(true);
    void fetchPage()
      .then((res) => {
        if (current !== search.current) return undefined;
        setSamples(res.data);
        setHasMore(res.data.length >= PAGE_SIZE);
        setLoading(false);
        return undefined;
      })
      .catch(() => {
        if (current === search.current) setLoading(false);
      });
  }, [fetchPage]);

  useEffect(() => {
    void api()
      .get<BoothSamplePack[]>('/api/v1/booth_sample_packs')
      .then((res) => {
        setPacks(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, []);

  const handleLoadMore = useCallback(() => {
    const last = samples[samples.length - 1];
    if (!last) return;
    const current = search.current;
    setLoadingMore(true);
    void fetchPage(last.id)
      .then((res) => {
        if (current !== search.current) return undefined;
        setSamples((list) => [...list, ...res.data]);
        setHasMore(res.data.length >= PAGE_SIZE);
        setLoadingMore(false);
        return undefined;
      })
      .catch(() => {
        setLoadingMore(false);
      });
  }, [samples, fetchPage]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  const handleClear = useCallback(() => {
    setInput('');
    setQuery('');
  }, []);
  const handleShare = useCallback(() => {
    history.push('/hub/booth/composer/sample');
  }, [history]);

  const nothingAtAll = !loading && !filtering && samples.length === 0;

  if (nothingAtAll) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
        action={
          <KornerPill
            variant='primary'
            label={intl.formatMessage(messages.share)}
            onClick={handleShare}
          />
        }
      />
    );
  }

  return (
    <div className='booth-samples'>
      {!filtering && packs.length > 0 && (
        <section className='booth-shelf'>
          <div className='booth-shelf__head'>
            <h2 className='booth-shelf__title'>
              {intl.formatMessage(messages.packs)}
            </h2>
          </div>
          <SpaceGrid layout='row' wide>
            {packs.map((pack) => (
              <SamplePackCard
                key={pack.id}
                pack={pack}
                tag={intl.formatMessage(messages.pack)}
                countLabel={intl.formatMessage(messages.packCount, {
                  count: pack.sample_count,
                })}
              />
            ))}
          </SpaceGrid>
        </section>
      )}

      <div className='booth-filters'>
        <div className='booth-search'>
          <Icon id='search' icon={SearchIcon} />
          <input
            type='search'
            value={input}
            onChange={handleInput}
            placeholder={intl.formatMessage(messages.search)}
            aria-label={intl.formatMessage(messages.search)}
          />
          {input && (
            <button
              type='button'
              onClick={handleClear}
              aria-label={intl.formatMessage(messages.clearSearch)}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
          )}
        </div>
        <KornerActionBar className='booth-samples__types'>
          <FilterPill
            value='all'
            label={intl.formatMessage(messages.all)}
            chosen={filter}
            onChoose={setFilter}
          />
          {SAMPLE_TYPES.map((type) => (
            <FilterPill
              key={type}
              value={type}
              label={intl.formatMessage(sampleTypeName(type))}
              chosen={filter}
              onChoose={setFilter}
            />
          ))}
          <FilterPill
            value='yours'
            label={intl.formatMessage(messages.yours)}
            chosen={filter}
            onChoose={setFilter}
          />
        </KornerActionBar>
      </div>

      {loading ? (
        <LoadingState label={intl.formatMessage(messages.loading)} />
      ) : samples.length === 0 ? (
        <EmptyState title={intl.formatMessage(messages.noMatch)} />
      ) : (
        <SpaceGrid className='booth-samples__grid'>
          {samples.map((sample) => (
            <SampleCard key={sample.id} sample={sample} />
          ))}
        </SpaceGrid>
      )}

      {!loading && hasMore && (
        <KornerActionBar align='center'>
          <KornerPill
            label={intl.formatMessage(messages.loadMore)}
            onClick={handleLoadMore}
            disabled={loadingMore}
          />
        </KornerActionBar>
      )}
    </div>
  );
};
