import { useEffect, useMemo } from 'react';

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
// that has a backing Status (Tal 2026-09-03/04).
//
// Deliberately no bespoke chrome — no "Replies" header, no
// "No replies yet" empty state, no divider between actions and
// replies. Feed doesn't have any of those; this primitive matches
// the feed treatment exactly:
//   * <StatusActionBar> renders bare (its own component-level SCSS
//     owns the row look).
//   * Replies stack via <StatusQuoteManager> just like they would on
//     a status permalink page — no wrapping list, no headers.
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
    <div className={`status-engagement${className ? ` ${className}` : ''}`}>
      <StatusActionBar status={status} />

      {descendantsIds.map((id, i) => (
        <StatusQuoteManager
          key={id}
          id={id}
          contextType='thread'
          previousId={i > 0 ? descendantsIds[i - 1] : undefined}
          nextId={descendantsIds[i + 1]}
          rootId={statusId}
        />
      ))}
    </div>
  );
};
