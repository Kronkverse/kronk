// The Mates face — the third face of the profile drum, at
// `/@:acct/mates`.
//
// A simple list of the subject's Mates, where a Mate is a mutual follow
// (the relationship the reach ladder is built on — see
// docs/rebuild/decisions.md). The shell owns the fetch and the empty /
// error / loading states; the list is a pure consumer.
//
// The event-timeline drawing retired 2026-08-11 (Tal: keep it a list). The
// list became Mates-only on 2026-09-03 (Tal: "just a simple list of
// someone's mates") — before that it mixed in the inviter and invitees off
// the graph payload, which made "Mates" mean something different here than
// it means everywhere else in the product.

import { defineMessages, useIntl } from 'react-intl';

import { LoadingIndicator } from 'mastodon/components/loading_indicator';

import { MatesListView } from './list_view';
import { useMatesList } from './use_mates_list';

const messages = defineMessages({
  title: { id: 'mates_tab.title', defaultMessage: 'Mates' },
  error: {
    id: 'mates_tab.error',
    defaultMessage: "Couldn't load Mates. Try again in a moment.",
  },
});

export const MatesFace: React.FC<{ acct: string }> = ({ acct }) => {
  const intl = useIntl();
  const { accountIds, loading, loadingMore, error, hasMore, loadMore } =
    useMatesList(acct);

  return (
    <div className='mates-tab'>
      {loading && <LoadingIndicator />}

      {Boolean(error) && !loading && (
        <div
          className='mates-tab__status mates-tab__status--error'
          role='alert'
        >
          {intl.formatMessage(messages.error)}
        </div>
      )}

      {!loading && !error && (
        <MatesListView
          accountIds={accountIds}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      )}
    </div>
  );
};
