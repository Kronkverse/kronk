import { useEffect, useMemo } from 'react';

import { FormattedMessage } from 'react-intl';

import { fetchContext } from 'mastodon/actions/statuses_typed';
// StatusActionBar is wrapped in withRouter + injectIntl HOCs on the
// legacy .jsx side; its outer type doesn't expose the `status` prop
// TypeScript needs. Cast to any-props for the local shape rather
// than unpick the HOC chain here.
import StatusActionBarUntyped from 'mastodon/components/status_action_bar';
import { StatusQuoteManager } from 'mastodon/components/status_quoted';
// `makeGetStatus` lives in a .js selector file — untyped. It merges
// the full account record into the status. Reading
// `state.statuses.get(id)` directly returns a status whose `account`
// is just an ID string — `<StatusActionBar>` crashes then because
// it does `status.get('account').get('username')` (Tal 2026-09-04
// shadow console: `p.get is not a function` at index.jsx:296:79).
import * as selectors from 'mastodon/selectors';
import { getDescendantsIds } from 'mastodon/selectors/contexts';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StatusActionBar = StatusActionBarUntyped as React.ComponentType<any>;

/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return */
const makeGetStatus: () => (state: any, props: { id: string }) => any = (
  selectors as any
).makeGetStatus;

// Kronk — standardised reactions bar + inline reply thread. The
// single engagement surface any detail page can drop under an item
// that has a backing Status (Tal 2026-09-03).
//
// Two parts, one component:
//   1. The classic feed action bar (reply / boost / froth / bookmark
//      / share / more) — rendered directly by the existing shared
//      `<StatusActionBar>` on the target status. Just the bar, not
//      the full feed status card — the parent surface (lightbox /
//      trek detail / moment viewer) has already rendered the item
//      itself.
//   2. An always-expanded reply thread below — fetched via
//      `fetchContext`, rendered through `<StatusQuoteManager>`
//      (which DOES render the full card because a reply IS a full
//      status the reader hasn't seen).
//
// Prerequisite: the caller must ensure the target `statusId` is
// already in the Redux `statuses` slice (typically via
// `dispatch(importFetchedStatus(...))` on mount).

interface Props {
  statusId: string;
  className?: string;
}

export const StatusEngagement: React.FC<Props> = ({ statusId, className }) => {
  const dispatch = useAppDispatch();
  // Memoise the selector per-component instance — `makeGetStatus`
  // returns a new selector each call; recreating it on every render
  // would defeat its reselect cache.
  const getStatus = useMemo(() => makeGetStatus(), []);
  const status: any = useAppSelector((state) =>
    getStatus(state, { id: statusId }),
  );
  const descendantsIds = useAppSelector((state) =>
    getDescendantsIds(state, statusId),
  );

  useEffect(() => {
    void dispatch(fetchContext({ statusId }));
  }, [dispatch, statusId]);

  if (!status) return null;

  return (
    <section
      className={`status-engagement${className ? ` ${className}` : ''}`}
      aria-label='Reactions and replies'
    >
      <div className='status-engagement__actions'>
        <StatusActionBar status={status} />
      </div>

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
