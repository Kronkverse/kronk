import { useCallback, useEffect } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';

import { useIdentity } from '@/mastodon/identity_context';
import {
  fetchRelationships,
  mateAccount,
  unmateAccount,
  unmuteAccount,
} from 'mastodon/actions/accounts';
import { openModal } from 'mastodon/actions/modal';
import { Button } from 'mastodon/components/button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { useBreakpoint } from '../features/ui/hooks/useBreakpoint';

// Kronk — Mates. The connect button speaks the Mates vocabulary
// (docs/kronk_feed_and_reach.md §1): **Mate** is the action verb
// (send a Mates request); **Mating…** is a pending outgoing request
// (tap to withdraw); **Unmate** removes an established Mate; **Accept**
// converts an inbound request to Mates (auto-mutual).
//
// Copy unified into one word family (Kommons proposal
// #117047168766649089, 2026-08-06): button verb and state noun share
// a stem, so "Mate them → Mating… → Mates" reads as one journey
// instead of two vocabularies (Groove-the-verb / Mate-the-noun) the
// user had to hold in their head. Message IDs stay stable — this is a
// defaultMessage swap only, so translations that already track the
// IDs don't churn, and the underlying data primitives (still
// `mate` / `mates`) are untouched.
const longMessages = defineMessages({
  unblock: { id: 'account.unblock_short', defaultMessage: 'Unblock' },
  unmute: { id: 'account.unmute_short', defaultMessage: 'Unmute' },
  mate: { id: 'account.mate', defaultMessage: 'Mate' },
  mating: { id: 'account.mating', defaultMessage: 'Mating…' },
  unmate: { id: 'account.unmate', defaultMessage: 'Unmate' },
  mateAccept: { id: 'account.mate_accept', defaultMessage: 'Accept' },
  editProfile: { id: 'account.edit_profile', defaultMessage: 'Edit profile' },
});

const shortMessages = {
  ...longMessages, // Align type signature of shortMessages and longMessages
  ...defineMessages({
    editProfile: { id: 'account.edit_profile_short', defaultMessage: 'Edit' },
  }),
};

export const FollowButton: React.FC<{
  accountId?: string;
  compact?: boolean;
  labelLength?: 'auto' | 'short' | 'long';
  className?: string;
}> = ({ accountId, compact, labelLength = 'auto', className }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  const account = useAppSelector((state) =>
    accountId ? state.accounts.get(accountId) : undefined,
  );
  const relationship = useAppSelector((state) =>
    accountId ? state.relationships.get(accountId) : undefined,
  );
  // A "connected" state (mutual Mate or an outgoing pending request) styles
  // the button as secondary; an established Mate additionally reads as
  // destructive, because the action is Unmate.
  const isMate = relationship?.mate ?? false;
  const isPending = relationship?.requested ?? false;
  const connected = isMate || isPending;

  useEffect(() => {
    if (accountId && signedIn) {
      dispatch(fetchRelationships([accountId]));
    }
  }, [dispatch, accountId, signedIn]);

  const handleClick = useCallback(() => {
    if (!signedIn) {
      dispatch(
        openModal({
          modalType: 'INTERACTION',
          modalProps: {
            accountId: accountId,
            url: account?.url,
          },
        }),
      );
    }

    if (!relationship || !accountId) return;

    if (accountId === me) {
      return;
    } else if (relationship.muting) {
      dispatch(unmuteAccount(accountId));
    } else if (relationship.blocking) {
      dispatch(
        openModal({
          modalType: 'CONFIRM_UNBLOCK',
          modalProps: { account },
        }),
      );
    } else if (relationship.mate || relationship.requested) {
      // Unmate an established Mate, or withdraw a pending outgoing request.
      dispatch(unmateAccount(accountId));
    } else {
      // Send a Mate request. If the other side already requested us,
      // Mates::RequestService turns this into an immediate accept.
      dispatch(mateAccount(accountId));
    }
  }, [dispatch, accountId, relationship, account, signedIn]);

  const isNarrow = useBreakpoint('narrow');
  const useShortLabel =
    labelLength === 'short' || (labelLength === 'auto' && isNarrow);
  const messages = useShortLabel ? shortMessages : longMessages;

  let label;
  let disabled =
    relationship?.blocked_by || account?.suspended || !!account?.moved;

  if (!signedIn) {
    label = intl.formatMessage(messages.mate);
  } else if (accountId === me) {
    label = intl.formatMessage(messages.editProfile);
  } else if (!relationship) {
    label = <LoadingIndicator />;
  } else if (relationship.muting) {
    label = intl.formatMessage(messages.unmute);
    disabled = false;
  } else if (relationship.blocking) {
    label = intl.formatMessage(messages.unblock);
    disabled = false;
  } else if (relationship.mate) {
    label = intl.formatMessage(messages.unmate);
    disabled = false;
  } else if (relationship.requested) {
    label = intl.formatMessage(messages.mating);
    disabled = false;
  } else if (relationship.requested_by) {
    // They have asked to be your Mate — tapping accepts (auto-mutual).
    label = intl.formatMessage(messages.mateAccept);
  } else {
    label = intl.formatMessage(messages.mate);
  }

  // Own-account: the classic Rails `/settings/profile` page is not
  // the right editor for the shelved profile (2026-08-02) — that page
  // still uses the Mastodon-standard bio/hashtag copy and diverges
  // from the new composer. The proper edit surface is Arrange mode on
  // `/@:acct/shelves` (opened from the shelved profile's header). No
  // button here until the SPA route around Arrange is wired inline.
  if (accountId === me) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled}
      secondary={connected}
      compact={compact}
      className={classNames(className, { 'button--destructive': isMate })}
    >
      {label}
    </Button>
  );
};
