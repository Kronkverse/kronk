import { useEffect, useMemo } from 'react';

import { connect } from 'react-redux';

import { fetchContext } from 'mastodon/actions/statuses_typed';
// StatusActionBar is wrapped in withRouter + injectIntl HOCs on the
// legacy .jsx side; its outer type doesn't expose the `status` prop
// TypeScript needs. Cast to any-props for the local shape rather
// than unpick the HOC chain here.
import StatusActionBarUntyped from 'mastodon/components/status_action_bar';
import { StatusQuoteManager } from 'mastodon/components/status_quoted';
// Same dispatch bindings the feed's <StatusContainer> wraps
// <StatusActionBar> with — reply / froth / boost / bookmark / share /
// menu items. Without these the buttons render but silently no-op
// (Tal 2026-09-10: "the reaction buttons do nothing currently, in
// album view or photo view"). Shared so both surfaces stay in step.
import { statusDispatchToProps } from 'mastodon/containers/status_dispatch';
// `makeGetStatus` lives in a .js selector file — untyped. It merges
// the full account record into the status. Reading
// `state.statuses.get(id)` directly returns a status whose `account`
// is just an ID string — `<StatusActionBar>` crashes then because
// it does `status.get('account').get('username')` (Tal 2026-09-04
// shadow console: `p.get is not a function` at index.jsx:296:79).
import * as selectors from 'mastodon/selectors';
import { getDescendantsIds } from 'mastodon/selectors/contexts';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

/* eslint-disable @typescript-eslint/no-explicit-any */
const StatusActionBarUnconnected =
  StatusActionBarUntyped as React.ComponentType<any>;
const StatusActionBar = connect(
  null,
  statusDispatchToProps as any,
)(StatusActionBarUnconnected) as React.ComponentType<any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  // Whether to render the reply thread + fetch its context. Detail
  // pages (album lightbox, moment viewer, trek detail) leave it on;
  // list surfaces where each item has its own detail (album scroll,
  // moment grid) turn it off — the action bar still lets the viewer
  // froth / reply from the tile, and tapping the item opens the full
  // thread. Skipping the context fetch matters on lists that render
  // dozens of items at once (Tal 2026-09-09).
  showThread?: boolean;
}

export const StatusEngagement: React.FC<Props> = ({
  statusId,
  className,
  showThread = true,
}) => {
  const dispatch = useAppDispatch();
  // Memoise the selector per-component instance — `makeGetStatus`
  // returns a new selector each call; recreating it on every render
  // would defeat its reselect cache.
  const getStatus = useMemo(() => makeGetStatus(), []);
  const status: any = useAppSelector((state) =>
    getStatus(state, { id: statusId }),
  );
  const descendantsIds = useAppSelector((state) =>
    showThread ? getDescendantsIds(state, statusId) : [],
  );

  useEffect(() => {
    if (!showThread) return;
    void dispatch(fetchContext({ statusId }));
  }, [dispatch, statusId, showThread]);

  if (!status) return null;

  return (
    <div className={`status-engagement${className ? ` ${className}` : ''}`}>
      <StatusActionBar status={status} />

      {showThread &&
        descendantsIds.map((id, i) => (
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
