import { useEffect, useMemo } from 'react';

import { Link } from 'react-router-dom';

import { fetchStatus } from 'mastodon/actions/statuses';
import { Avatar } from 'mastodon/components/avatar';
import type { Account } from 'mastodon/models/account';
import type { Status } from 'mastodon/models/status';
import { makeGetStatus } from 'mastodon/selectors';
import type { RootState } from 'mastodon/store';
import { useAppDispatch, useAppSelector } from 'mastodon/store';
import { unescapeHTML } from 'mastodon/utils/html';

type GetStatusSelector = (
  state: RootState,
  props: { id: string },
) => Status | undefined;

// A shared Kronk status URL renders as a compact card inside the
// message bubble per brief §Surface 3 ("Post-share cards render a
// shared Status as a proper card, not a raw link"). Kept lightweight
// — avatar + author + a truncated single-line body — so several cards
// in a busy chat stay legible.
export const InlineStatusCard: React.FC<{ statusId: string }> = ({
  statusId,
}) => {
  const dispatch = useAppDispatch();
  const getStatus = useMemo(
    () => makeGetStatus() as unknown as GetStatusSelector,
    [],
  );
  const status = useAppSelector((state) => getStatus(state, { id: statusId }));

  useEffect(() => {
    // fetchStatus is a no-op if the status is already in the store.
    // `alsoFetchContext: false` — context is timeline chatter, not
    // needed for a preview card.
    dispatch(fetchStatus(statusId, { alsoFetchContext: false }));
  }, [dispatch, statusId]);

  if (!status) {
    return (
      <span
        className='nudges-share-card nudges-share-card--loading'
        aria-busy='true'
      />
    );
  }

  const account = status.get('account') as Account | undefined;
  const acct = account?.get('acct') ?? '';
  const rawDisplayName = account?.get('display_name');
  const rawUsername = account?.get('username');
  const displayName =
    (rawDisplayName && rawDisplayName.trim() !== '' ? rawDisplayName : null) ??
    rawUsername ??
    '';
  const handle = account ? `@${acct}` : '';
  const content = (status.get('content') as string | undefined) ?? '';
  const bodyText = unescapeHTML(content).trim();
  const to = `/@${acct}/${statusId}`;

  return (
    <Link to={to} className='nudges-share-card'>
      <span className='nudges-share-card__head'>
        {account && (
          <span className='nudges-share-card__avatar'>
            <Avatar account={account} size={20} />
          </span>
        )}
        <span className='nudges-share-card__author'>
          <span className='nudges-share-card__name'>{displayName}</span>
          <span className='nudges-share-card__handle'>{handle}</span>
        </span>
      </span>
      {bodyText && <span className='nudges-share-card__body'>{bodyText}</span>}
    </Link>
  );
};
