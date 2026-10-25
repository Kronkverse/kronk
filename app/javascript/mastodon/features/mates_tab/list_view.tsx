// Mates list view — the list on /@:acct/mates.
//
// A plain list of the subject's Mates: one shared `<Account>` row per
// person, inside the page's `.stage-column`. Tap a row → their
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
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';

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
    return <EmptyState title={intl.formatMessage(messages.empty)} />;
  }

  return (
    <div className='mates-list'>
      {accountIds.map((id) => (
        <Account key={id} id={id} withMenu={false} />
      ))}

      {hasMore &&
        (loadingMore ? (
          <LoadingState />
        ) : (
          <KornerActionBar align='center'>
            <KornerPill
              label={intl.formatMessage(messages.loadMore)}
              onClick={onLoadMore}
            />
          </KornerActionBar>
        ))}
    </div>
  );
};
