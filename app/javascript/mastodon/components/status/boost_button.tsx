import { useCallback, useMemo } from 'react';
import type { FC, MouseEventHandler } from 'react';

import { useIntl } from 'react-intl';

import { toggleReblog } from '@/mastodon/actions/interactions';
import { openModal } from '@/mastodon/actions/modal';
import type { Status } from '@/mastodon/models/status';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';

import { IconButton } from '../icon_button';

import { boostItemState, selectStatusState } from './boost_button_utils';

// Boost button — single-action variant only. Kronk retired the
// quote primitive 2026-09-13 (Tal audit), so the "Boost or quote"
// dropdown collapsed to just the standalone Boost tap; the two
// menu items had become one. Inbound federated quotes still
// render + revoke through `StatusQuoteManager`; new-quote
// composition is gone.

interface ReblogButtonProps {
  status: Status;
  counters?: boolean;
}

const StandaloneBoostButton: FC<ReblogButtonProps> = ({ status, counters }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const statusState = useAppSelector((state) =>
    selectStatusState(state, status),
  );
  const { title, meta, iconComponent, disabled } = useMemo(
    () => boostItemState(statusState),
    [statusState],
  );

  const handleClick: MouseEventHandler = useCallback(
    (event) => {
      if (statusState.isLoggedIn) {
        dispatch(toggleReblog(status.get('id') as string, event.shiftKey));
      } else {
        dispatch(
          openModal({
            modalType: 'INTERACTION',
            modalProps: {
              accountId: status.getIn(['account', 'id']),
              url: status.get('uri'),
            },
          }),
        );
      }
    },
    [dispatch, status, statusState.isLoggedIn],
  );

  return (
    <IconButton
      disabled={disabled}
      active={!!status.get('reblogged')}
      title={intl.formatMessage(meta ?? title)}
      icon='retweet'
      iconComponent={iconComponent}
      onClick={!disabled ? handleClick : undefined}
      counter={
        counters
          ? (status.get('reblogs_count') as number) +
            (status.get('quotes_count') as number)
          : undefined
      }
    />
  );
};

export const BoostButton = StandaloneBoostButton;
