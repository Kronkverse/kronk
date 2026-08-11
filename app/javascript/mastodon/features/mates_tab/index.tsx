// /@:acct/mates — the Mates page.
//
// A single list of the subject's community — mates + inviter +
// invitees — with real avatars and a "Mates since {date}" line per
// row. The event-timeline view retired 2026-08-11 (Tal: keep it a
// list). The shell owns the async fetch + resolves the subject; the
// list is a pure consumer.

import { useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useParams } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { MatesListView } from './list_view';
import { useMatesTimeline } from './use_mates_timeline';

const messages = defineMessages({
  title: { id: 'mates_tab.title', defaultMessage: 'Mates' },
  loading: { id: 'mates_tab.loading', defaultMessage: 'Loading Mates…' },
  error: {
    id: 'mates_tab.error',
    defaultMessage: "Couldn't load Mates. Try again in a moment.",
  },
  empty: {
    id: 'mates_tab.empty',
    defaultMessage:
      'No Mates yet — invite someone or Mate a Kronker to get things started.',
  },
});

const MatesTab = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct: string }>();
  const { data, loading, error } = useMatesTimeline(acct);

  const subject = useMemo(() => {
    if (!data) return null;
    if (acct) {
      const match = data.members.find((m) => m.handle === acct);
      if (match) return match;
    }
    // Fallback: rank 1 is the timeline anchor per the API contract.
    return data.members.find((m) => m.rank === 1) ?? data.members[0] ?? null;
  }, [data, acct]);

  return (
    <Stage bindToDocument label={intl.formatMessage(messages.title)}>
      <div className='mates-tab'>
        {loading && !data && (
          <div className='mates-tab__status'>
            {intl.formatMessage(messages.loading)}
          </div>
        )}
        {Boolean(error) && !data && (
          <div
            className='mates-tab__status mates-tab__status--error'
            role='alert'
          >
            {intl.formatMessage(messages.error)}
          </div>
        )}
        {data && (!subject || data.members.length <= 1) && (
          <div className='mates-tab__status'>
            {intl.formatMessage(messages.empty)}
          </div>
        )}
        {data && subject && data.members.length > 1 && (
          <MatesListView data={data} subject={subject} />
        )}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export
export default MatesTab;
