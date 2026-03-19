import { useEffect, useRef, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import type { List as ImmutableList, Map as ImmutableMap } from 'immutable';

import GroupIcon from '@/material-icons/400-24px/group-fill.svg?react';
import { addColumn, removeColumn, moveColumn } from 'mastodon/actions/columns';
import { expandFriendsActivity } from 'mastodon/actions/friends_activity';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import ScrollableList from 'mastodon/components/scrollable_list';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import ActivityItem from './components/activity_item';

const messages = defineMessages({
  heading: { id: 'orbit.title', defaultMessage: 'Orbit' },
});

const Activity: React.FC<{
  columnId: string;
  multiColumn: boolean;
}> = ({ columnId, multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const columnRef = useRef<ColumnRef>(null);

  const items = useAppSelector(
    (state) =>
      state.friends_activity.get('items') as ImmutableList<
        ImmutableMap<string, unknown>
      >,
  );
  const isLoading = useAppSelector(
    (state) => state.friends_activity.get('isLoading') as boolean,
  );
  const hasMore = useAppSelector(
    (state) => state.friends_activity.get('hasMore') as boolean,
  );

  useEffect(() => {
    dispatch(expandFriendsActivity());
  }, [dispatch]);

  const handlePin = useCallback(() => {
    if (columnId) {
      dispatch(removeColumn(columnId));
    } else {
      dispatch(addColumn('ORBIT', {}));
    }
  }, [dispatch, columnId]);

  const handleMove = useCallback(
    (dir: number) => {
      dispatch(moveColumn(columnId, dir));
    },
    [dispatch, columnId],
  );

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  const handleLoadMore = useCallback(() => {
    if (items.size === 0) return;
    const lastItem = items.last();
    if (!lastItem) return;
    const maxId = lastItem.get('statusId') as string;
    dispatch(expandFriendsActivity({ maxId }));
  }, [dispatch, items]);

  const pinned = !!columnId;

  const emptyMessage = (
    <FormattedMessage
      id='orbit.empty'
      defaultMessage="Nothing in your orbit yet. When people you follow interact with posts, they'll show up here."
    />
  );

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        icon='group'
        iconComponent={GroupIcon}
        title={intl.formatMessage(messages.heading)}
        onPin={handlePin}
        onMove={handleMove}
        onClick={handleHeaderClick}
        pinned={pinned}
        multiColumn={multiColumn}
      />
      <ScrollableList
        trackScroll={!pinned}
        scrollKey={`activity-${columnId}`}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={handleLoadMore}
        emptyMessage={emptyMessage}
        bindToDocument={!multiColumn}
      >
        {items.map((item: ImmutableMap<string, unknown>) => {
          const statusId = item.get('statusId') as string;
          const interactions = item.get('interactions') as ImmutableList<
            ImmutableMap<string, string>
          >;
          return (
            <ActivityItem
              key={statusId}
              statusId={statusId}
              interactions={interactions}
            />
          );
        })}
      </ScrollableList>
      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Activity;
