import { useEffect } from 'react';

import { FormattedMessage } from 'react-intl';

import { fetchContext } from 'mastodon/actions/statuses_typed';
import { StatusQuoteManager } from 'mastodon/components/status_quoted';
import { getDescendantsIds } from 'mastodon/selectors/contexts';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Kronk — standardised reactions bar + inline reply thread. The
// single engagement surface any detail page can drop under an item
// that has a backing Status (Tal 2026-09-03: "let's build the
// standardisation for the reactions bar and comments section... use
// it for multiple areas, such as for treks").
//
// Two parts, one component:
//   1. The classic feed action bar (reply / boost / froth / bookmark
//      / share / more) — rendered by the existing shared
//      `<StatusActionBar>` via `<StatusQuoteManager>`, so the actions
//      are exactly the same as the feed and stay in sync automatically
//      if the feed bar is redesigned.
//   2. An always-expanded reply thread below — the same status-thread
//      rendering the status permalink page uses. Descendants are
//      fetched via `fetchContext` on mount + kept fresh via Redux.
//
// Empty-state: when there are no replies, the section shows a short
// "No replies yet" line so the shape is stable across states.
//
// Prerequisite: the caller must ensure the target `statusId` is
// already in the Redux `statuses` slice (typically via
// `dispatch(importFetchedStatuses(...))` on mount). Album lightbox,
// trek detail, moment viewer — all planned adopters — already
// hydrate their backing statuses.

interface Props {
  statusId: string;
  className?: string;
}

export const StatusEngagement: React.FC<Props> = ({ statusId, className }) => {
  const dispatch = useAppDispatch();
  const descendantsIds = useAppSelector((state) =>
    getDescendantsIds(state, statusId),
  );

  useEffect(() => {
    void dispatch(fetchContext({ statusId }));
  }, [dispatch, statusId]);

  return (
    <section
      className={`status-engagement${className ? ` ${className}` : ''}`}
      aria-label='Reactions and replies'
    >
      {/* Action bar — rendered by feeding the target status through the
          shared `<StatusQuoteManager>` in `thread` context. That reuses
          the same status shell + `<StatusActionBar>` the status permalink
          page uses, so the actions stay identical to the feed. Root
          highlight is not applied here — this isn't a permalink page. */}
      <StatusQuoteManager id={statusId} contextType='thread' />

      <div className='status-engagement__thread'>
        <header className='status-engagement__thread-header'>
          <FormattedMessage
            id='status_engagement.thread_heading'
            defaultMessage='Replies'
          />
        </header>

        {descendantsIds.length === 0 ? (
          <p className='status-engagement__empty'>
            <FormattedMessage
              id='status_engagement.no_replies'
              defaultMessage='No replies yet.'
            />
          </p>
        ) : (
          <ol className='status-engagement__replies'>
            {descendantsIds.map((id, i) => (
              <li key={id} className='status-engagement__reply'>
                <StatusQuoteManager
                  id={id}
                  contextType='thread'
                  previousId={i > 0 ? descendantsIds[i - 1] : undefined}
                  nextId={descendantsIds[i + 1]}
                  rootId={statusId}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};
