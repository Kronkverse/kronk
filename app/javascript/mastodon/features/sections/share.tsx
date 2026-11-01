import { useCallback, useEffect } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { expandAccountTimeline } from 'mastodon/actions/timelines';
import { EmptyState } from 'mastodon/components/empty_state';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import StatusListContainer from 'mastodon/features/ui/containers/status_list_container';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { KornerCard, SectionHeader, useSectionKorners } from './korner_tiles';
import { SHARE_KORNERS } from './sections';

// Share (/share): what goes out from you (Tal, 2026-11-01). The ways to
// share across the top, each opening its korner's own composer (the
// manifest's `compose:`), then what you've shared, newest first. The Ж
// menu's + stays the quick way to make something wherever you are.

const messages = defineMessages({
  title: { id: 'sections.share.title', defaultMessage: 'Share' },
  tagline: {
    id: 'sections.share.tagline',
    defaultMessage: 'Everything you put out into Kronk starts here.',
  },
  ways: { id: 'sections.share.ways', defaultMessage: 'Share something' },
  post: { id: 'sections.share.post', defaultMessage: 'Post' },
  yours: { id: 'sections.share.yours', defaultMessage: 'What you’ve shared' },
  empty: {
    id: 'sections.share.empty',
    defaultMessage: 'Nothing shared yet.',
  },
  emptyHint: {
    id: 'sections.share.empty_hint',
    defaultMessage: 'Pick a way to share above and it shows up here.',
  },
});

const Share: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const korners = useSectionKorners(SHARE_KORNERS).filter((k) => k.compose);

  useEffect(() => {
    if (me) void dispatch(expandAccountTimeline(me));
  }, [dispatch]);

  const handleLoadMore = useCallback(
    (maxId: string) => {
      if (me) void dispatch(expandAccountTimeline(me, { maxId }));
    },
    [dispatch],
  );

  const title = intl.formatMessage(messages.title);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className='section-page section-page--share'>
        <SectionHeader
          title={title}
          tagline={intl.formatMessage(messages.tagline)}
        />

        <section className='section-page__section'>
          <h2 className='korner-section-heading'>
            <FormattedMessage {...messages.ways} />
          </h2>
          <SpaceGrid layout='row' className='section-page__tiles'>
            <SpaceCard
              to='/publish'
              placeholder={
                <Icon
                  id='edit'
                  icon={EditIcon}
                  className='section-page__glyph'
                />
              }
              title={intl.formatMessage(messages.post)}
            />
            {korners.map((k) => (
              <KornerCard
                key={k.slug}
                korner={k}
                to={k.compose?.route}
                label={k.compose?.label}
              />
            ))}
          </SpaceGrid>
        </section>

        <section className='section-page__section section-page__yours'>
          <h2 className='korner-section-heading'>
            <FormattedMessage {...messages.yours} />
          </h2>
          {me && (
            <StatusListContainer
              timelineId={`account:${me}`}
              onLoadMore={handleLoadMore}
              scrollKey='share-yours'
              trackScroll={false}
              emptyMessage={
                <EmptyState
                  title={<FormattedMessage {...messages.empty} />}
                  body={<FormattedMessage {...messages.emptyHint} />}
                />
              }
            />
          )}
        </section>
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default Share;
