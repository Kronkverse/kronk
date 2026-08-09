// /@:acct/mates — the Mates page. Two views (Tal 2026-08-07,
// "redesign this: a simple list, and a timeline that's actually
// useful"):
//
//   • List — clean scannable roster of mates + inviter + invitees
//     with search + filter. Default view; the primary way people
//     answer "who am I connected to?".
//   • Timeline — chronological history of graph changes. Not a
//     canvas of floating dots; a proper event stream you can read.
//
// The shell owns the async fetch + view state; each view is a pure
// consumer of `MatesTimelineData` + the resolved subject. Retired
// the SVG timeline + right-hand contacts rail + detail panel that
// used to live here — the two-view shape is the whole story now.

import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useParams } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { MatesEventTimeline } from './event_timeline';
import { MatesListView } from './list_view';
import { useMatesTimeline } from './use_mates_timeline';

type View = 'list' | 'timeline';

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
  tabList: { id: 'mates_tab.tab_list', defaultMessage: 'List' },
  tabTimeline: {
    id: 'mates_tab.tab_timeline',
    defaultMessage: 'Timeline',
  },
});

const MatesTab = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct: string }>();
  const { data, loading, error } = useMatesTimeline(acct);
  const [view, setView] = useState<View>('list');

  const subject = useMemo(() => {
    if (!data) return null;
    if (acct) {
      const match = data.members.find((m) => m.handle === acct);
      if (match) return match;
    }
    // Fallback: rank 1 is the timeline anchor per the API contract.
    return data.members.find((m) => m.rank === 1) ?? data.members[0] ?? null;
  }, [data, acct]);

  const handleView = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setView(event.currentTarget.dataset.view as View);
    },
    [],
  );

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
          <>
            <div className='mates-tab__tabs' role='tablist'>
              <TabButton
                view='list'
                active={view === 'list'}
                onClick={handleView}
                label={intl.formatMessage(messages.tabList)}
              />
              <TabButton
                view='timeline'
                active={view === 'timeline'}
                onClick={handleView}
                label={intl.formatMessage(messages.tabTimeline)}
              />
            </div>
            {view === 'list' && <MatesListView data={data} subject={subject} />}
            {view === 'timeline' && (
              <MatesEventTimeline data={data} subject={subject} />
            )}
          </>
        )}
      </div>
    </Stage>
  );
};

interface TabButtonProps {
  view: View;
  active: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  view,
  active,
  onClick,
  label,
}) => (
  <button
    type='button'
    role='tab'
    aria-selected={active}
    data-view={view}
    className={`mates-tab__tab${active ? ' mates-tab__tab--active' : ''}`}
    onClick={onClick}
  >
    {label}
  </button>
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export
export default MatesTab;
