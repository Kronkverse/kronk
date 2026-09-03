// Mates list view — the only face of /@:acct/mates.
//
// A plain list of the subject's Mates: one shared `<Account>` row per
// person, in the standard `.stage-column` measure. Tap a row → their
// profile; the row carries its own relationship button and menu because
// it is the same component every other people-list on Kronk uses.
//
// History (Tal 2026-09-03: "just a simple list of someone's mates"): the
// event-timeline drawing retired 2026-08-11, but the list that replaced it
// still rendered the whole community — mates, the inviter, and invitees —
// off the graph payload, with hand-rolled avatar/name markup and a
// "Mates since {date}" line. It is now Mates only, off the paginated
// `/api/v1/accounts/:id/mates` endpoint. Two things went with that change:
// the inviter/invitee rows (they are lineage, not Mates — they belong to
// the Kommunity graph) and the bond date (the shared row has no subtitle
// slot; worth adding back deliberately rather than by hand-rolling a row).

import { defineMessages, useIntl } from 'react-intl';

import { Account } from 'mastodon/components/account';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';

const messages = defineMessages({
  empty: {
    id: 'mates_tab.list.empty',
    defaultMessage: 'No Mates yet.',
  },
  loadMore: {
    id: 'mates_tab.list.load_more',
    defaultMessage: 'Load more',
  },
});

interface MatesListViewProps {
  accountIds: string[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export const MatesListView: React.FC<MatesListViewProps> = ({
  accountIds,
  hasMore,
  loadingMore,
  onLoadMore,
}) => {
  const intl = useIntl();

  if (accountIds.length === 0) {
    return (
      <div className='mates-list__empty'>
        {intl.formatMessage(messages.empty)}
      </div>
    );
  }

  return (
    <div className='stage-column'>
      <div className='stage-column__inner mates-list'>
        {accountIds.map((id) => (
          <Account key={id} id={id} withMenu={false} />
        ))}

        {hasMore &&
          (loadingMore ? (
            <LoadingIndicator />
          ) : (
            <button
              type='button'
              className='mates-list__more'
              onClick={onLoadMore}
            >
              {intl.formatMessage(messages.loadMore)}
            </button>
          ))}
      </div>
    </div>
  );
};
