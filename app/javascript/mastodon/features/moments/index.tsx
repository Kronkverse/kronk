import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import api from 'mastodon/api';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import { StoryViewer } from './components/story_viewer';

const messages = defineMessages({
  title: { id: 'moments.title', defaultMessage: 'Moments' },
  empty: {
    id: 'moments.empty',
    defaultMessage:
      'No moments yet. Share something that will only last 24 hours.',
  },
});

const Moments: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const [moments, setMoments] = useState<ApiStatusJSON[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMoments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api().get<ApiStatusJSON[]>('/api/v1/moments');
      setMoments(res.data);
    } catch (err) {
      console.error('Failed to fetch moments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMoments();
  }, [fetchMoments]);

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='photo_library'
        iconComponent={planetIcon('Moments')}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn}
      />

      <div
        className='moments-page scrollable'
        style={
          { '--space-color': spaceColor('Moments') } as React.CSSProperties
        }
      >
        {loading ? (
          <div className='moments-page__loading' />
        ) : moments.length === 0 ? (
          <div className='moment-viewer__empty'>
            {intl.formatMessage(messages.empty)}
          </div>
        ) : (
          <StoryViewer moments={moments} />
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default Moments;
