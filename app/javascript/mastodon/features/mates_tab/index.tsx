// The Mates list, at `/@:acct/mates`, under the profile block.
//
// A simple list of the subject's Mates, where a Mate is a mutual follow
// (the relationship the reach ladder is built on — see
// docs/decisions.md). Reached by tapping the Mates count on the profile;
// the back chip returns to the profile. The shell owns the fetch and the
// empty / error / loading states; the list is a pure consumer.
//
// Who sees it (Tal, 2026-10-26): the member themselves and their Mates.
// The profile decides that before mounting this (`canSeeMates`), and the
// server enforces it (Api::V1::Accounts::MatesController).
//
// The event-timeline drawing retired 2026-08-11 (Tal: keep it a list). The
// list became Mates-only on 2026-09-03 (Tal: "just a simple list of
// someone's mates"). It was off from 2026-10-18 to 2026-10-26, while it
// was settled who may see whose Mates.

import { defineMessages, useIntl } from 'react-intl';

import { BackToKorner } from 'mastodon/components/back_to_korner';
import { EmptyState } from 'mastodon/components/empty_state';
import { LoadingState } from 'mastodon/components/loading_state';

import { MatesListView } from './list_view';
import { useMatesList } from './use_mates_list';

const messages = defineMessages({
  title: { id: 'mates_tab.title', defaultMessage: 'Mates' },
  error: {
    id: 'mates_tab.error',
    defaultMessage: "Couldn't load Mates. Try again in a moment.",
  },
});

export const MatesFace: React.FC<{ acct: string; backLabel: string }> = ({
  acct,
  backLabel,
}) => {
  const intl = useIntl();
  const { accountIds, loading, loadingMore, error, hasMore, loadMore } =
    useMatesList(acct);

  return (
    <div className='stage-column'>
      <div className='stage-column__inner mates-tab'>
        <BackToKorner href={`/@${acct}`} label={backLabel} />

        <h2 className='korner-section-heading'>
          {intl.formatMessage(messages.title)}
        </h2>

        {loading && <LoadingState />}

        {Boolean(error) && !loading && (
          <EmptyState title={intl.formatMessage(messages.error)} />
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
    </div>
  );
};
