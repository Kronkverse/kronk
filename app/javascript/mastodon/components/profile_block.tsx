import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { NavLink } from 'react-router-dom';

import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import { openModal } from 'mastodon/actions/modal';
import { apiGetNudgeStreak } from 'mastodon/api/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { MatesCounter, StatusesCounter } from 'mastodon/components/counters';
import { DisplayName } from 'mastodon/components/display_name';
import { AnimateEmojiProvider } from 'mastodon/components/emoji/context';
import { FollowButton } from 'mastodon/components/follow_button';
import { Icon } from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { ShortNumber } from 'mastodon/components/short_number';
import { MemorialNote } from 'mastodon/features/account_timeline/components/memorial_note';
import { MovedNote } from 'mastodon/features/account_timeline/components/moved_note';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useIdentity } from 'mastodon/identity_context';
import { me } from 'mastodon/initial_state';
import { getAccountHidden } from 'mastodon/selectors/accounts';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

// ProfileBlock — the one identity block, rendered identically on every
// face of a person's space (Profile / Timeline / Mates) and on any
// remaining `/@:acct/*` leaf. Nothing below it is its business: the
// drum swaps the content, the block does not move.
//
// It replaces two headers that had been drifting apart — the spare
// `profile_shelves/components/profile_header` on `/@:acct` and the rich
// `account_timeline/components/account_header` everywhere else — which
// meant the chrome changed under you as you crossed between halves of
// the same profile (audit: docs/spaces/profile.md).
//
// Four things the legacy header carried are deliberately absent
// (decided 2026-09-15, docs/spaces/profile.md § The profile block):
//
//   * the domain pill — Kronk is stepping back from federation for 2.0,
//     so the host next to every handle labels a distinction the product
//     no longer draws;
//   * familiar followers ("Followed by X, Y and 25 others") — too busy
//     for a block that has to hold one height across every face;
//   * the notify-me-when-they-post bell — retired outright;
//   * the three-dot menu — becomes the per-person settings screen,
//     reached from the Ж menu.
//
// What's left is identity, one relationship button, the Nudge, and the
// two counts.

const messages = defineMessages({
  accountLocked: {
    id: 'account.locked_info',
    defaultMessage:
      'This account privacy status is set to locked. The owner manually reviews who can follow them.',
  },
  nudge: { id: 'account.nudge', defaultMessage: 'Nudge {name}' },
  nudgeSent: {
    id: 'account.nudge_sent',
    defaultMessage: 'Nudge sent to {name}',
  },
  nudgeWaiting: {
    id: 'account.nudge_waiting',
    defaultMessage: '{name} needs to Nudge you back first',
  },
});

interface Props {
  accountId: string;
  // Gated / limited view: identity only — no cover, no counts, no
  // actions. The face below renders the "become Mates" prompt.
  minimal?: boolean;
  // Owner-only affordances the face wants inline with the identity.
  // Arrange lives on the Profile face's own toolbar, so this is empty
  // in practice today; kept because the slot is the natural home for
  // anything that is about *this person* rather than about the face.
  actions?: React.ReactNode;
}

export const ProfileBlock: React.FC<Props> = ({
  accountId,
  minimal = false,
  actions,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { signedIn } = useIdentity();
  const account = useAppSelector((state) => state.accounts.get(accountId));
  const relationship = useAppSelector((state) =>
    state.relationships.get(accountId),
  );
  const hidden = useAppSelector((state) => getAccountHidden(state, accountId));
  const gated = useAppSelector(
    (state) =>
      accountId !== me &&
      state.relationships.get(accountId)?.profile_visible === false,
  );

  const [nudgeSent, setNudgeSent] = useState(false);
  const [canNudge, setCanNudge] = useState(true);

  useEffect(() => {
    if (!accountId || !signedIn || accountId === me) return;
    apiGetNudgeStreak(accountId)
      .then((data) => {
        setCanNudge(data.can_nudge);
        return undefined;
      })
      .catch(() => {
        // Worst case the button offers an attempt and the compose
        // modal surfaces the server's own error.
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

  if (!account) return null;

  const bare = minimal || hidden || gated;
  const isSelf = accountId === me;
  // `acct` carries the domain for remote accounts; the block shows the
  // username alone. The full address is still what the API and the AP
  // collections speak — this is a display decision, not a data one.
  const username = account.acct.split('@')[0] ?? account.acct;

  const cover =
    account.header && !account.header.endsWith('/headers/original/missing.png')
      ? account.header
      : undefined;

  // The relationship states the legacy header carried as its `info`
  // row. They are not decoration: "Blocking" / "Muting" is often the
  // only reason a profile looks empty, and dropping them with the old
  // header would have made that state invisible.
  const tags: React.ReactNode[] = [];
  if (!isSelf && relationship) {
    if (relationship.mate) {
      tags.push(
        <span key='mate' className='relationship-tag'>
          <FormattedMessage id='account.mutual' defaultMessage="You're Mates" />
        </span>,
      );
    } else if (relationship.followed_by) {
      tags.push(
        <span key='followed_by' className='relationship-tag'>
          <FormattedMessage
            id='account.follows_you'
            defaultMessage='Follows you'
          />
        </span>,
      );
    } else if (relationship.requested_by) {
      tags.push(
        <span key='requested_by' className='relationship-tag'>
          <FormattedMessage
            id='account.requests_to_follow_you'
            defaultMessage='Requests to follow you'
          />
        </span>,
      );
    }

    if (relationship.blocking) {
      tags.push(
        <span key='blocking' className='relationship-tag'>
          <FormattedMessage id='account.blocking' defaultMessage='Blocking' />
        </span>,
      );
    }

    if (relationship.muting) {
      tags.push(
        <span key='muting' className='relationship-tag'>
          <FormattedMessage id='account.muting' defaultMessage='Muting' />
        </span>,
      );
    }
  }

  const canNudgeThem =
    signedIn &&
    !isSelf &&
    !bare &&
    !relationship?.blocking &&
    !relationship?.blocked_by;

  const nudgeTitle = nudgeSent
    ? intl.formatMessage(messages.nudgeSent, { name: username })
    : canNudge
      ? intl.formatMessage(messages.nudge, { name: username })
      : intl.formatMessage(messages.nudgeWaiting, { name: username });

  return (
    <AnimateEmojiProvider className='profile-block'>
      {account.memorial && <MemorialNote />}
      {account.moved && (
        <MovedNote accountId={accountId} targetAccountId={account.moved} />
      )}

      {!bare && (
        <div
          className='profile-block__cover'
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          {tags.length > 0 && <div className='profile-block__tags'>{tags}</div>}
        </div>
      )}

      <div className='profile-block__ident'>
        <Avatar account={account} size={86} />

        <div className='profile-block__names'>
          <h1 className='profile-block__name'>
            <DisplayName account={account} variant='simple' />
          </h1>
          <div className='profile-block__handle'>
            @{username}
            {account.locked && (
              <Icon
                id='lock'
                icon={LockIcon}
                aria-label={intl.formatMessage(messages.accountLocked)}
              />
            )}
          </div>
        </div>

        {actions && <div className='profile-block__own'>{actions}</div>}
      </div>

      {!bare && !isSelf && (
        <div className='profile-block__actions'>
          <FollowButton accountId={accountId} labelLength='long' />

          {canNudgeThem && (
            <IconButton
              icon='nudge'
              iconComponent={kornerIcon('nudges')}
              active={nudgeSent}
              disabled={!canNudge}
              title={nudgeTitle}
              onClick={handleNudge}
            />
          )}
        </div>
      )}

      {!bare && (
        <div className='profile-block__counts'>
          <NavLink
            exact
            to={`/@${account.acct}/posts`}
            title={intl.formatNumber(account.statuses_count)}
          >
            <ShortNumber
              value={account.statuses_count}
              renderer={StatusesCounter}
            />
          </NavLink>

          <NavLink
            exact
            to={`/@${account.acct}/mates`}
            title={intl.formatNumber(account.mates_count)}
          >
            <ShortNumber value={account.mates_count} renderer={MatesCounter} />
          </NavLink>
        </div>
      )}
    </AnimateEmojiProvider>
  );
};
