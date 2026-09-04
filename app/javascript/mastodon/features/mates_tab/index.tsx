// /@:acct/mates — the Mates page.
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

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { Stage } from 'mastodon/components/stage';
import { AccountHeader } from 'mastodon/features/account_timeline/components/account_header';

import { MatesListView } from './list_view';
import { useMatesList } from './use_mates_list';

const messages = defineMessages({
  title: { id: 'mates_tab.title', defaultMessage: 'Mates' },
  error: {
    id: 'mates_tab.error',
    defaultMessage: "Couldn't load Mates. Try again in a moment.",
  },
});

const MatesTab = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct: string }>();
  const {
    accountIds,
    subject,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
  } = useMatesList(acct);

  const title = intl.formatMessage(messages.title);
  const heading = subject?.display_name
    ? `${subject.display_name} — ${title}`
    : title;

  return (
    <Stage bindToDocument label={title}>
      <Helmet>
        <title>{heading}</title>
      </Helmet>

      {/* The profile header, which this page had none of — you could land on
          someone's Mates and see no indication whose they were, and no way
          back into their profile. It also carries the shared profile
          navigation (docs/spaces/profile.md Stage 3). */}
      {subject && <AccountHeader accountId={subject.id} />}

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
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export
export default MatesTab;
