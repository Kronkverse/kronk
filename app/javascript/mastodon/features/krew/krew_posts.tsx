import { useCallback, useEffect } from 'react';

import { defineMessages, FormattedMessage } from 'react-intl';

import { expandKrewTimeline } from 'mastodon/actions/timelines';
import { EmptyState } from 'mastodon/components/empty_state';
import StatusListContainer from 'mastodon/features/ui/containers/status_list_container';
import { useAppDispatch } from 'mastodon/store';

// The Krew's posts, for members, at the foot of the Krew page: the
// standard feed card in the standard timeline (`krew:<id>`), newest first,
// loading more as you scroll (GET /api/v1/krews/:id/statuses). Back by
// Tal's "Krew space feed" proposal (decisions.md, 2026-10-27).

const messages = defineMessages({
  heading: { id: 'krew.posts.heading', defaultMessage: 'Posts' },
  empty: {
    id: 'krew.posts.empty',
    defaultMessage: 'No posts in this Krew yet.',
  },
  emptyHint: {
    id: 'krew.posts.empty_hint',
    defaultMessage: 'Post to the Krew with + and it shows up here.',
  },
});

export const KrewPosts: React.FC<{ krewId: string }> = ({ krewId }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(expandKrewTimeline(krewId));
  }, [dispatch, krewId]);

  const handleLoadMore = useCallback(
    (maxId: string) => {
      void dispatch(expandKrewTimeline(krewId, { maxId }));
    },
    [dispatch, krewId],
  );

  return (
    <section className='krew-detail__section krew-detail__posts'>
      <h3 className='korner-section-heading'>
        <FormattedMessage {...messages.heading} />
      </h3>
      <StatusListContainer
        timelineId={`krew:${krewId}`}
        onLoadMore={handleLoadMore}
        scrollKey={`krew_posts-${krewId}`}
        trackScroll={false}
        emptyMessage={
          <EmptyState
            title={<FormattedMessage {...messages.empty} />}
            body={<FormattedMessage {...messages.emptyHint} />}
          />
        }
      />
    </section>
  );
};
