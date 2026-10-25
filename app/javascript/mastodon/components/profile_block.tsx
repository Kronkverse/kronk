import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import AddPhotoAlternateIcon from '@/material-icons/400-24px/add_photo_alternate.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import LockIcon from '@/material-icons/400-24px/lock.svg?react';
import ShareIcon from '@/material-icons/400-24px/share.svg?react';
import { composeOnProfile } from 'mastodon/actions/compose';
import { apiGetSentRoses, apiSendRose } from 'mastodon/api/rose';
import { AccountBio } from 'mastodon/components/account_bio';
import { Avatar } from 'mastodon/components/avatar';
import { MatesCounter, StatusesCounter } from 'mastodon/components/counters';
import { DisplayName } from 'mastodon/components/display_name';
import { AnimateEmojiProvider } from 'mastodon/components/emoji/context';
import { FollowButton } from 'mastodon/components/follow_button';
import { Icon } from 'mastodon/components/icon';
import { IconButton } from 'mastodon/components/icon_button';
import { ProfileBioField } from 'mastodon/components/profile_bio_field';
import { ProfileCountryField } from 'mastodon/components/profile_country_field';
import { ShareSheet } from 'mastodon/components/share_sheet';
import { ShortNumber } from 'mastodon/components/short_number';
import { MemorialNote } from 'mastodon/features/account_timeline/components/memorial_note';
import { MovedNote } from 'mastodon/features/account_timeline/components/moved_note';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useSaveOwnProfile } from 'mastodon/hooks/useSaveOwnProfile';
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
// The actions row is the "bank of options for interacting with someone"
// (Tal 2026-09-16): Nudge · Rose · Share, plus the Mate? invitation for
// non-Mates. Once Mates, the Unmate verb lives on `/@:acct/settings`
// (the per-person settings screen) — it's the same action worded for
// the surface that owns relationship management, and repeating it in the
// block would be two doors to one room. The Mate? / Mating… / Accept
// button stays because that's initiating, not disconnecting.
//
// Nudge is a link, not a modal — it takes you to `/nudges/with/{accountId}`,
// the conversation with that person. Sending happens there. Prior to
// 2026-09-16 the button opened a "just nudge / add a message" modal
// (`NUDGE_COMPOSE`), but a drive-by nudge without a conversation isn't
// how Nudges works — the messenger is the surface, so the button opens
// the messenger.
//
// Share opens the shared `<ShareSheet>` primitive (send-in-nudges +
// copy-link + native share), pointing at the profile URL.

const messages = defineMessages({
  accountLocked: {
    id: 'account.locked_info',
    defaultMessage:
      'This account privacy status is set to locked. The owner manually reviews who can follow them.',
  },
  nudge: { id: 'account.nudge', defaultMessage: 'Nudge {name}' },
  postOnProfile: {
    id: 'account.post_on_profile',
    defaultMessage: 'Post on {name}’s profile',
  },
  rose: { id: 'account.rose', defaultMessage: 'Send {name} a rose' },
  roseSent: {
    id: 'account.rose_sent',
    defaultMessage: 'You sent {name} a rose today',
  },
  share: { id: 'account.share', defaultMessage: 'Share {name}’s profile' },
  changeCover: {
    id: 'profile_block.change_cover',
    defaultMessage: 'Change cover',
  },
  changeAvatar: {
    id: 'profile_block.change_avatar',
    defaultMessage: 'Change photo',
  },
  displayName: {
    id: 'profile_block.display_name',
    defaultMessage: 'Display name',
  },
  saving: { id: 'profile_block.saving', defaultMessage: 'Saving…' },
  saveError: {
    id: 'profile_block.save_error',
    defaultMessage: "Couldn't save — try again.",
  },
});

// Editing your own profile happens on it, not in a form below it (Tal
// 2026-10-13): the cover and photo take a new picture where they are, the
// name becomes a field where it is. Each saves the moment it changes.
const PhotoPicker: React.FC<{
  className: string;
  label: string;
  showLabel?: boolean;
  onPick: (file: File) => void;
}> = ({ className, label, showLabel = false, onPick }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onPick(file);
      // Let the same file be picked again after a failed save.
      e.target.value = '';
    },
    [onPick],
  );

  return (
    <label className={className} title={label}>
      <input type='file' hidden accept='image/*' onChange={handleChange} />
      <Icon id='' icon={AddPhotoAlternateIcon} aria-hidden />
      {showLabel ? (
        <span>{label}</span>
      ) : (
        <span className='sr-only'>{label}</span>
      )}
    </label>
  );
};

const NameField: React.FC<{
  initial: string;
  label: string;
  onSave: (name: string) => void;
}> = ({ initial, label, onSave }) => {
  const [value, setValue] = useState(initial);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);
  const handleBlur = useCallback(() => {
    if (value !== initial) onSave(value);
  }, [initial, onSave, value]);

  return (
    <input
      className='profile-block__name-input'
      type='text'
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      maxLength={30}
      aria-label={label}
    />
  );
};

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
  // Your own profile, being edited: cover, photo and name edit in place.
  editing?: boolean;
}

export const ProfileBlock: React.FC<Props> = ({
  accountId,
  minimal = false,
  actions,
  editing = false,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const { signedIn } = useIdentity();
  const dispatch = useAppDispatch();
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

  // Icons resolved via the manifest hook so a `config/korners/*.yaml`
  // icon swap propagates without touching this file. `kornerIcon` (the
  // non-hook variant) reads the store once at render time and doesn't
  // re-subscribe — if `fetchKorners` hadn't landed yet the button would
  // cache the AccentCircle fallback and never flip to the real glyph.
  const nudgesIcon = useKornerIcon('nudges');
  const roseIcon = useKornerIcon('rose');

  const [shareOpen, setShareOpen] = useState(false);

  // One rose per Mate per Kronk day. The button opens in the right
  // state rather than finding out by being tapped: today's sent roses
  // are a short list (bounded by how many Mates you have), so one
  // request answers it for whoever you are looking at.
  const [roseSent, setRoseSent] = useState(false);

  useEffect(() => {
    if (!accountId || !signedIn || accountId === me) return;

    let cancelled = false;

    apiGetSentRoses()
      .then((roses) => {
        if (!cancelled) {
          setRoseSent(roses.some((rose) => rose.to_account.id === accountId));
        }
        return undefined;
      })
      .catch(() => {
        // Leave the button offering a rose; the send path answers 409
        // if one already went today, and settles the state then.
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, signedIn]);

  // Mates can post on each other's profile (unless the owner has turned
  // that off, which the server answers). The composer opens saying whose
  // profile it is for.
  const handlePostOnProfile = useCallback(() => {
    if (account) dispatch(composeOnProfile(account));
  }, [account, dispatch]);

  const handleRose = useCallback(() => {
    if (roseSent) return;

    // Optimistic: the tap IS the feedback, and there is nothing to undo.
    setRoseSent(true);

    apiSendRose(accountId).catch(() => {
      // 409 means a rose already went today, which the button is now
      // showing correctly anyway; 403 means the Mate bond went, in
      // which case the button should not have been there.
    });
  }, [accountId, roseSent]);

  const handleNudge = useCallback(() => {
    history.push(`/nudges/with/${accountId}`);
  }, [accountId, history]);

  const handleShareOpen = useCallback(() => {
    setShareOpen(true);
  }, []);
  const handleShareClose = useCallback(() => {
    setShareOpen(false);
  }, []);

  const { status: saveStatus, save } = useSaveOwnProfile();
  const saveCover = useCallback(
    (file: File) => {
      save({ header: file });
    },
    [save],
  );
  const saveAvatar = useCallback(
    (file: File) => {
      save({ avatar: file });
    },
    [save],
  );
  const saveName = useCallback(
    (name: string) => {
      save({ display_name: name });
    },
    [save],
  );

  // On a Mate's profile the Ж + posts on it (Tal 2026-10-17). Your own
  // profile has no +: you post from Home. Same gate as the button below.
  useRegisterPageAction(
    {
      key: 'post',
      label: intl.formatMessage(messages.postOnProfile, {
        name: account ? account.display_name || account.username : '',
      }),
      icon: AddIcon,
      iconId: 'add',
    },
    handlePostOnProfile,
    !!account &&
      signedIn &&
      accountId !== me &&
      !minimal &&
      !hidden &&
      !gated &&
      Boolean(relationship?.mate),
  );

  if (!account) return null;

  const bare = minimal || hidden || gated;
  const isSelf = accountId === me;
  const editable = editing && isSelf && !bare;
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
    } else if (relationship.requested_by) {
      // A Mate request waiting on you. A one-way follow on its own means
      // nothing on Kronk any more (Mates replaced following), so it gets
      // no tag.
      tags.push(
        <span key='requested_by' className='relationship-tag'>
          <FormattedMessage
            id='account.wants_to_be_mates'
            defaultMessage='Wants to be Mates'
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

  // Mates only — a rose is not a way to reach a stranger. `mate` is the
  // relationship's own mutual flag, so it hides the moment either side
  // of the bond goes.
  const canSendRose =
    signedIn && !isSelf && !bare && Boolean(relationship?.mate);

  // Share doesn't need a relationship — anyone can share a public
  // profile URL. Hidden on your own profile (self-share is noise) and
  // when the block is bare (gated / hidden / minimal), matching the
  // rest of the actions row.
  const canShare = !isSelf && !bare;

  // Once Mates, the connect-slot is owned by the settings screen
  // (`/@:acct/settings` — Unmate lives there under a name that fits its
  // surface). The block keeps the button for every other state: Mate?
  // (invite), Mating… (withdraw), Accept (inbound request), Unblock,
  // Unmute — all of which are initiating or unblocking, not
  // disconnecting from an established Mate.
  const showFollowButton = signedIn && !isSelf && !bare && !relationship?.mate;

  const roseTitle = roseSent
    ? intl.formatMessage(messages.roseSent, { name: username })
    : intl.formatMessage(messages.rose, { name: username });

  const nudgeTitle = intl.formatMessage(messages.nudge, { name: username });
  const shareTitle = intl.formatMessage(messages.share, { name: username });

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
          {editable && (
            <PhotoPicker
              className='profile-block__change profile-block__change--cover'
              label={intl.formatMessage(messages.changeCover)}
              showLabel
              onPick={saveCover}
            />
          )}
        </div>
      )}

      <div className='profile-block__ident'>
        {editable ? (
          <span className='profile-block__avatar-edit'>
            <Avatar account={account} size={86} />
            <PhotoPicker
              className='profile-block__change profile-block__change--avatar'
              label={intl.formatMessage(messages.changeAvatar)}
              onPick={saveAvatar}
            />
          </span>
        ) : (
          <Avatar account={account} size={86} />
        )}

        <div className='profile-block__names'>
          {editable ? (
            <NameField
              initial={account.display_name}
              label={intl.formatMessage(messages.displayName)}
              onSave={saveName}
            />
          ) : (
            <h1 className='profile-block__name'>
              <DisplayName account={account} variant='simple' />
            </h1>
          )}
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

      {editable && (saveStatus === 'saving' || saveStatus === 'error') && (
        <p
          className={`profile-block__save${saveStatus === 'error' ? ' profile-block__save--error' : ''}`}
          role='status'
        >
          {intl.formatMessage(
            saveStatus === 'error' ? messages.saveError : messages.saving,
          )}
        </p>
      )}

      {!bare && !isSelf && (
        <div className='profile-block__actions'>
          {showFollowButton && (
            <FollowButton accountId={accountId} labelLength='long' />
          )}

          {canNudgeThem && (
            <IconButton
              icon='nudge'
              iconComponent={nudgesIcon}
              title={nudgeTitle}
              onClick={handleNudge}
            />
          )}

          {canSendRose && (
            <IconButton
              icon='edit'
              iconComponent={EditIcon}
              title={intl.formatMessage(messages.postOnProfile, {
                name: account.display_name || account.username,
              })}
              onClick={handlePostOnProfile}
            />
          )}

          {canSendRose && (
            <IconButton
              icon='rose'
              iconComponent={roseIcon}
              active={roseSent}
              disabled={roseSent}
              title={roseTitle}
              onClick={handleRose}
            />
          )}

          {canShare && (
            <IconButton
              icon='share'
              iconComponent={ShareIcon}
              title={shareTitle}
              onClick={handleShareOpen}
            />
          )}
        </div>
      )}

      {!bare && (
        <div className='profile-block__counts'>
          {/* Counts only: the timeline is under the profile, and the
              Mates list is off for now (Tal 2026-10-18). */}
          <span title={intl.formatNumber(account.statuses_count)}>
            <ShortNumber
              value={account.statuses_count}
              renderer={StatusesCounter}
            />
          </span>

          <span title={intl.formatNumber(account.mates_count)}>
            <ShortNumber value={account.mates_count} renderer={MatesCounter} />
          </span>

          <span className='profile-block__joined'>
            <FormattedMessage
              id='profile_block.joined'
              defaultMessage='Joined {date}'
              values={{
                date: intl.formatDate(account.created_at, {
                  month: 'short',
                  year: 'numeric',
                }),
              }}
            />
          </span>
        </div>
      )}

      {/* The bio, under the counts (Tal 2026-10-15; it was a loose block
          on the Profile face below). A field where it shows while you
          design your profile. A gated profile shows it too: it is what a
          stranger reads before asking to be Mates (decisions.md,
          2026-08-16). */}
      {(!bare || (gated && !hidden && !minimal)) &&
        (editable ? (
          <>
            <ProfileBioField />
            <ProfileCountryField />
          </>
        ) : (
          <>
            <AccountBio accountId={accountId} className='profile-block__bio' />
            {/* The First Nations Country they live on, under the bio and
                seen wherever it is (docs/spaces/profile.md, Country). */}
            {account.first_nations_country && (
              <p className='profile-block__country'>
                <FormattedMessage
                  id='profile_block.country'
                  defaultMessage='On {name} Country'
                  values={{ name: account.first_nations_country }}
                />
              </p>
            )}
          </>
        ))}

      {canShare && (
        <ShareSheet
          open={shareOpen}
          onClose={handleShareClose}
          url={`${window.location.origin}/@${account.acct}`}
          title={account.display_name.trim() || `@${account.acct}`}
          body={null}
          author={{
            name: account.display_name.trim() || account.username,
            acct: account.acct,
            avatar: account.avatar,
          }}
        />
      )}
    </AnimateEmojiProvider>
  );
};
