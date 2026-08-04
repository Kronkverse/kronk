import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import MoreHorizIcon from '@/material-icons/400-24px/more_horiz.svg?react';
import PartnerExchangeIcon from '@/material-icons/400-24px/partner_exchange.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { initBlockModal } from 'mastodon/actions/blocks';
import { openModal } from 'mastodon/actions/modal';
import { initMuteModal } from 'mastodon/actions/mutes';
import { initReport } from 'mastodon/actions/reports';
import { apiGetNudgeStreak } from 'mastodon/api/accounts';
import { CopyIconButton } from 'mastodon/components/copy_icon_button';
import { Dropdown } from 'mastodon/components/dropdown_menu';
import { FollowButton } from 'mastodon/components/follow_button';
import { IconButton } from 'mastodon/components/icon_button';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import type { MenuItem } from 'mastodon/models/dropdown_menu';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// Shelved-profile viewer actions — the row of affordances alongside
// the identity in the header when you're looking at someone else's
// profile. Delegates entirely to primitives already used in
// `account_timeline/components/account_header.tsx` — this component
// exists to compose them into a compact row that fits the shelved
// profile's spare header, without dragging in the rest of the
// classic header's bio / stats / tabs / relationships-tag chrome.
//
// Copy comes through the underlying components (FollowButton owns
// the Groove/Mate/Ungroove/Accept label; the More menu items own
// their own labels). This component adds no new user-facing text
// beyond the icon-button ARIA labels, so a global copy sweep on any
// of those primitives flows through unchanged.

const messages = defineMessages({
  nudge: { id: 'account.nudge', defaultMessage: 'Nudge {name}' },
  nudgeSent: {
    id: 'account.nudge_sent',
    defaultMessage: 'Nudge sent to {name}',
  },
  nudgeWaiting: {
    id: 'account.nudge_waiting',
    defaultMessage: '{name} needs to Nudge you back first',
  },
  share: { id: 'account.share', defaultMessage: "Share @{name}'s profile" },
  copy: { id: 'account.copy', defaultMessage: 'Copy link to profile' },
  moreActions: {
    id: 'account.more_actions',
    defaultMessage: 'More actions',
  },
  openOriginalPage: {
    id: 'account.open_original_page',
    defaultMessage: 'Open original page',
  },
  mute: { id: 'account.mute', defaultMessage: 'Mute @{name}' },
  block: { id: 'account.block', defaultMessage: 'Block @{name}' },
  report: { id: 'account.report', defaultMessage: 'Report @{name}' },
});

interface ProfileViewerActionsProps {
  accountId: string;
  className?: string;
}

export const ProfileViewerActions: React.FC<ProfileViewerActionsProps> = ({
  accountId,
  className,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  const account = useAppSelector((state) => state.accounts.get(accountId));
  const relationship = useAppSelector((state) =>
    state.relationships.get(accountId),
  );

  // Nudge rate-limit — same pattern as account_header. `can_nudge`
  // comes from the server's streak endpoint (turn-based; you can't
  // Nudge again until the other side has Nudged you back). We
  // optimistically clear it once the local send resolves.
  const [nudgeSent, setNudgeSent] = useState(false);
  const [canNudge, setCanNudge] = useState(true);

  useEffect(() => {
    if (!accountId || !signedIn || accountId === me) return;
    apiGetNudgeStreak(accountId)
      .then((data) => {
        setCanNudge(data.can_nudge);
      })
      .catch(() => {
        /* silently ignore — worst case the Nudge button offers an
           attempt and the compose modal shows the server error. */
      });
  }, [accountId, signedIn]);

  const handleNudge = useCallback(() => {
    if (!canNudge) return;
    dispatch(
      openModal({
        modalType: 'NUDGE_COMPOSE',
        modalProps: {
          accountId,
          onSent: () => {
            setNudgeSent(true);
            setCanNudge(false);
          },
        },
      }),
    );
  }, [accountId, canNudge, dispatch]);

  const handleShare = useCallback(() => {
    if (!account) return;
    void navigator
      .share({
        text: account.display_name,
        url: account.url,
      })
      .catch(() => {
        // User dismissed the share sheet, or share failed. No-op.
      });
  }, [account]);

  const handleMute = useCallback(() => {
    if (!account) return;
    if (relationship?.muting) return;
    dispatch(initMuteModal(account));
  }, [dispatch, account, relationship]);

  const handleBlock = useCallback(() => {
    if (!account) return;
    dispatch(initBlockModal(account));
  }, [dispatch, account]);

  const handleReport = useCallback(() => {
    if (!account) return;
    dispatch(initReport(account));
  }, [dispatch, account]);

  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];
    if (!account) return items;

    const isRemote = account.acct !== account.username;
    if (isRemote) {
      items.push({
        text: intl.formatMessage(messages.openOriginalPage),
        href: account.url,
      });
      items.push(null);
    }

    if (signedIn) {
      items.push({
        text: intl.formatMessage(messages.mute, { name: account.username }),
        action: handleMute,
        dangerous: false,
      });
      items.push({
        text: intl.formatMessage(messages.block, { name: account.username }),
        action: handleBlock,
        dangerous: true,
      });
      items.push({
        text: intl.formatMessage(messages.report, {
          name: account.username,
        }),
        action: handleReport,
        dangerous: true,
      });
    }

    return items;
  }, [account, signedIn, intl, handleMute, handleBlock, handleReport]);

  // Own account → no viewer actions. Owner-only affordances (Arrange)
  // are passed from the parent instead of composed here.
  if (!account || accountId === me) return null;

  const rootClass = ['profile-viewer-actions', className ?? '']
    .filter(Boolean)
    .join(' ');

  // Signed-out: the FollowButton primitive already handles the
  // sign-in prompt (opens the INTERACTION modal on click). Show just
  // it — no Nudge / More menu affordances make sense until signed in.
  if (!signedIn) {
    return (
      <div className={rootClass}>
        <FollowButton accountId={accountId} labelLength='long' />
      </div>
    );
  }

  const shareSupported =
    typeof navigator !== 'undefined' && 'share' in navigator;

  const nudgeTitle = nudgeSent
    ? intl.formatMessage(messages.nudgeSent, { name: account.username })
    : !canNudge
      ? intl.formatMessage(messages.nudgeWaiting, { name: account.username })
      : intl.formatMessage(messages.nudge, { name: account.username });

  return (
    <div className={rootClass}>
      <FollowButton accountId={accountId} labelLength='long' />

      {!relationship?.blocking && !relationship?.blocked_by && (
        <IconButton
          icon='partner_exchange'
          iconComponent={PartnerExchangeIcon}
          active={nudgeSent}
          disabled={!canNudge}
          title={nudgeTitle}
          onClick={handleNudge}
        />
      )}

      {shareSupported ? (
        <IconButton
          icon=''
          iconComponent={ShareIcon}
          title={intl.formatMessage(messages.share, {
            name: account.username,
          })}
          onClick={handleShare}
        />
      ) : (
        <CopyIconButton
          className=''
          title={intl.formatMessage(messages.copy)}
          value={account.url}
        />
      )}

      <Dropdown
        disabled={menuItems.length === 0}
        items={menuItems}
        icon='ellipsis-h'
        iconComponent={MoreHorizIcon}
        title={intl.formatMessage(messages.moreActions)}
      />
    </div>
  );
};
