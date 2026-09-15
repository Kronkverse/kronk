// /me — the "Me" hub. Sits between the HubSwitcher's Me pillar and
// the user's public profile at `/@{username}`. A radial menu of
// self-related functions arrayed around the viewer's own avatar in
// the middle. Follows Tal's 2026-08-05 mockup.
//
// All eight slots on the ring are live now — no `?` placeholder.
// Clockwise from 12:
//
//   * Profile   → /@{username}          (public profile view)
//   * Mates     → /@{username}/mates    (mates list)
//   * Settings  → /settings             (3 o'clock — swapped in from
//                                        the last placeholder slot
//                                        2026-09-14)
//   * Switch    → account-switcher modal (real UX lands with
//                                        multi-account infra)
//   * Sign out  → /auth/sign_out        (Rails-served, DELETE)
//   * Invite    → invite modal (same modal that used to sit in the
//                                        top-right chrome — that
//                                        chrome button retired since
//                                        Me hub carries it)
//   * Kronk     → /kronk                (9 o'clock — the org space,
//                                        Rails-served. Uses the
//                                        wordmark's Ж glyph as its
//                                        spoke icon so the affordance
//                                        reads as Kronk even without
//                                        the top-left wordmark, which
//                                        is hidden on mobile.)
//   * Timeline  → /@{username}/posts    (their own posts stream,
//                                        matching the Timeline pillar
//                                        on the shelved profile)
//
// Center avatar opens a lightweight avatar-preview overlay (own
// component, no Redux modal) — the intent being "see your face at
// size, alongside how mates read your identity". Subtitle
// "Tap your face to see yourself the way a mate does" hints at
// that. Full "preview as a mate would" mode is a separate follow-up.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  defineMessages,
  FormattedDate,
  FormattedMessage,
  useIntl,
} from 'react-intl';

import { Helmet } from 'react-helmet';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';
import KeyIcon from '@/material-icons/400-24px/key.svg?react';
import LogoutIcon from '@/material-icons/400-24px/logout.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import SwapIcon from '@/material-icons/400-24px/sync_alt.svg?react';
import { importFetchedAccount } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Column } from 'mastodon/components/column';
import {
  KronkWheel,
  KronkWheelCentre,
  KronkWheelCentreGlyph,
} from 'mastodon/components/kronk_wheel';
import type { KronkWheelSpoke } from 'mastodon/components/kronk_wheel';
import { ShortNumber } from 'mastodon/components/short_number';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'me_hub.title', defaultMessage: 'Me' },
  // Shown in the space header when a signed-in account is available:
  // "@handle" reads more personally than the literal "Me" (Tal
  // 2026-08-11). Falls back to the generic `title` in the tab-title
  // + aria-label paths where the raw handle wouldn't add clarity.
  titleHandle: {
    id: 'me_hub.title_handle',
    defaultMessage: '@{handle}',
  },
  tagline: {
    id: 'me_hub.tagline',
    defaultMessage: 'Your Kronk, at a glance.',
  },
  profile: { id: 'me_hub.profile', defaultMessage: 'Profile' },
  timeline: { id: 'me_hub.timeline', defaultMessage: 'Timeline' },
  mates: { id: 'me_hub.mates', defaultMessage: 'Mates' },
  invite: { id: 'me_hub.invite', defaultMessage: 'Invite' },
  switchAccount: { id: 'me_hub.switch', defaultMessage: 'Switch' },
  signOut: { id: 'me_hub.sign_out', defaultMessage: 'Sign out' },
  settings: { id: 'me_hub.settings', defaultMessage: 'Settings' },
  kronk: { id: 'me_hub.kronk', defaultMessage: 'Kronk' },
  centerHint: {
    id: 'me_hub.center_hint',
    defaultMessage: 'Tap your face to see yourself the way a mate does.',
  },
  changePhoto: {
    id: 'me_hub.avatar_preview.change_photo',
    defaultMessage: 'Change photo',
  },
  addPhoto: {
    id: 'me_hub.avatar_preview.add_photo',
    defaultMessage: 'Add photo',
  },
  uploadPhoto: {
    id: 'me_hub.avatar_preview.upload',
    defaultMessage: 'Use this photo',
  },
  cancelPhoto: {
    id: 'me_hub.avatar_preview.cancel',
    defaultMessage: 'Cancel',
  },
  uploading: {
    id: 'me_hub.avatar_preview.uploading',
    defaultMessage: 'Uploading\u2026',
  },
  uploadFailed: {
    id: 'me_hub.avatar_preview.upload_failed',
    defaultMessage: "Couldn't upload — try again.",
  },
  statMates: {
    id: 'me_hub.avatar_preview.stat_mates',
    defaultMessage: 'Mates',
  },
  statPosts: {
    id: 'me_hub.avatar_preview.stat_posts',
    defaultMessage: 'Posts',
  },
  statJoined: {
    id: 'me_hub.avatar_preview.stat_joined',
    defaultMessage: 'Joined',
  },
});

// Spokes are built from the shared `KronkWheelSpoke` shape — the
// wheel primitive picks each spoke's semantic element (Link / a /
// button) from the props. Angle distribution + geometry live in
// `_kronk_wheel.scss`; nothing here needs to compute a bearing.

interface MeHubProps {
  // multiColumn / advancedInterface — kept for parity with other
  // top-level column components. Not consumed today.
  multiColumn?: boolean;
}

export const MeHub: React.FC<MeHubProps> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  const username = myAccount?.username ?? '';
  const profilePath = username ? `/@${username}` : '/getting-started';
  const timelinePath = username ? `/@${username}/posts` : '/getting-started';
  const matesPath = username ? `/@${username}/mates` : '/getting-started';

  const [avatarOpen, setAvatarOpen] = useState(false);
  const openAvatar = useCallback(() => {
    setAvatarOpen(true);
  }, []);
  const closeAvatar = useCallback(() => {
    setAvatarOpen(false);
  }, []);

  const openInvite = useCallback(() => {
    dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
  }, [dispatch]);
  const openSwitcher = useCallback(() => {
    dispatch(openModal({ modalType: 'ACCOUNT_SWITCHER', modalProps: {} }));
  }, [dispatch]);

  // Spokes clockwise from top. Every slot lives now — no `?`
  // placeholders. 3 o'clock is Settings, 9 o'clock is Kronk
  // (opposite pair) so the two most global affordances balance
  // the ring. Angle distribution + rendering live in
  // `<KronkWheel>` (see `components/kronk_wheel.tsx`).
  const spokes = useMemo<KronkWheelSpoke[]>(
    () => [
      {
        key: 'profile',
        label: intl.formatMessage(messages.profile),
        icon: PersonIcon,
        to: profilePath,
      },
      {
        key: 'mates',
        label: intl.formatMessage(messages.mates),
        icon: GroupIcon,
        to: matesPath,
      },
      {
        key: 'settings',
        label: intl.formatMessage(messages.settings),
        icon: SettingsIcon,
        to: '/settings',
      },
      {
        key: 'switch',
        label: intl.formatMessage(messages.switchAccount),
        icon: SwapIcon,
        onClick: openSwitcher,
      },
      {
        key: 'signout',
        label: intl.formatMessage(messages.signOut),
        icon: LogoutIcon,
        href: '/auth/sign_out',
        method: 'delete',
      },
      {
        key: 'invite',
        label: intl.formatMessage(messages.invite),
        icon: KeyIcon,
        onClick: openInvite,
      },
      {
        key: 'kronk',
        label: intl.formatMessage(messages.kronk),
        glyph: 'Ж',
        href: '/kronk',
      },
      {
        key: 'timeline',
        label: intl.formatMessage(messages.timeline),
        icon: HistoryIcon,
        to: timelinePath,
      },
    ],
    [intl, profilePath, matesPath, timelinePath, openInvite, openSwitcher],
  );

  const title = intl.formatMessage(messages.title);
  // Fallback chain for the center glyph when no avatar loads:
  // display_name → username → literal 'K'. Coerce empties via the
  // trim + explicit-length check rather than `||` (ESLint prefers
  // `??`, but `??` doesn't fall through empty strings). Explicit
  // check makes the intent obvious.
  const trimmedName = myAccount?.display_name.trim() ?? '';
  const trimmedUser = myAccount?.username.trim() ?? '';
  const glyphSource =
    trimmedName.length > 0
      ? trimmedName
      : trimmedUser.length > 0
        ? trimmedUser
        : 'K';
  const displayGlyph = glyphSource.charAt(0).toUpperCase();

  return (
    <Column bindToDocument label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='me-hub' role='navigation' aria-label={title}>
        {/* Background is the global <KronkKosmos> ambient canvas
            (mounted at Frame level in features/ui/index.jsx) — the
            .me-hub background is transparent so that sky shows
            through. No per-view star field. */}

        {/* Space title. /me isn't a `/hub/<slug>` route so the
            manifest-driven <AutoSpaceHeader> doesn't fire; we hand-
            render one using the same `.space-header` classes +
            `data-frame-header` attribute so it inherits the shared
            styling and passes the Frame-parasite <h1> exception
            (Standard L11). */}
        <header className='space-header me-hub__title' data-frame-header=''>
          <h1 className='space-header__title'>
            {username ? (
              <FormattedMessage
                {...messages.titleHandle}
                values={{ handle: username }}
              />
            ) : (
              <FormattedMessage {...messages.title} />
            )}
          </h1>
          <p className='space-header__tagline'>
            <FormattedMessage {...messages.tagline} />
          </p>
        </header>

        {/* Wheel + hint pair — wrapped so they can vertically center
            together in the space left below the title (which lives
            top-anchored above). Grid layout on `.me-hub` gives this
            stack `1fr` of vertical room, and the flex-column here
            centers wheel/hint inside it. Wheel geometry itself lives
            in the shared `<KronkWheel>` primitive. */}
        <div className='me-hub__stack'>
          <KronkWheel spokes={spokes} label={title}>
            {/* Centre: avatar or initial. Tapping opens the avatar
                preview overlay (below) — the Profile spoke is the
                affordance for navigating to the profile page. */}
            <KronkWheelCentre
              onClick={openAvatar}
              ariaLabel={intl.formatMessage(messages.profile)}
            >
              {myAccount?.avatar ? (
                <img
                  src={myAccount.avatar}
                  alt=''
                  aria-hidden
                  className='kronk-wheel__centre-avatar'
                />
              ) : (
                <KronkWheelCentreGlyph>{displayGlyph}</KronkWheelCentreGlyph>
              )}
            </KronkWheelCentre>
          </KronkWheel>

          <p className='me-hub__hint'>
            <FormattedMessage {...messages.centerHint} />
          </p>
        </div>
      </div>

      {avatarOpen && (
        <AvatarPreview
          avatarUrl={myAccount?.avatar}
          glyph={displayGlyph}
          displayName={
            trimmedName.length > 0 ? trimmedName : trimmedUser || username
          }
          handle={username ? `@${username}` : ''}
          matesCount={myAccount?.followers_count ?? 0}
          postsCount={myAccount?.statuses_count ?? 0}
          joinedAt={myAccount?.created_at}
          onClose={closeAvatar}
        />
      )}
    </Column>
  );
};

// Avatar preview overlay — opens on center-tap. Full-screen dim +
// the avatar at size + display name / handle + a Change/Add photo
// affordance. Backdrop click or Esc closes. Purposefully lightweight
// (no Redux modal dispatch, no MediaModal contract juggling) — this
// is a one-shot self-view + a shortcut to swap the avatar without
// leaving the /me hub.
//
// Upload flow: `<input type="file">` triggered from the visible
// button → PATCH /api/v1/accounts/update_credentials with just the
// `avatar` multipart field (deliberately not the full `updateAccount`
// thunk from `actions/accounts.js`, which also sends display_name /
// note / etc. and would overwrite them with whatever it thinks the
// current values are). On success we dispatch `importFetchedAccount`
// so `state.accounts[me]` picks up the new avatar URL immediately,
// then close the overlay. Bio / display-name / header edit surfaces
// stay TODO in `/settings/profile` for now — this slice is just the
// avatar.
interface AvatarPreviewProps {
  avatarUrl: string | undefined;
  glyph: string;
  displayName: string;
  handle: string;
  matesCount: number;
  postsCount: number;
  joinedAt: string | undefined;
  onClose: () => void;
}

const AvatarPreview: React.FC<AvatarPreviewProps> = ({
  avatarUrl,
  glyph,
  displayName,
  handle,
  matesCount,
  postsCount,
  joinedAt,
  onClose,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  // Object URL for the *pending* pick so the panel shows the selected
  // photo before it uploads. Regenerated whenever the pending file
  // changes; revoked on unmount / re-pick so we don't leak blob URLs.
  const previewUrl = useMemo(() => {
    if (!pendingFile) return null;
    return URL.createObjectURL(pendingFile);
  }, [pendingFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset the input value so re-picking the same file re-fires.
      event.target.value = '';
      if (!file) return;
      setUploadFailed(false);
      setPendingFile(file);
    },
    [],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const cancelPending = useCallback(() => {
    setPendingFile(null);
    setUploadFailed(false);
  }, []);

  const confirmUpload = useCallback(async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadFailed(false);
    try {
      const form = new FormData();
      form.append('avatar', pendingFile);
      const response = await api().patch<ApiAccountJSON>(
        '/api/v1/accounts/update_credentials',
        form,
      );
      dispatch(importFetchedAccount(response.data));
      onClose();
    } catch {
      setUploadFailed(true);
      setUploading(false);
    }
  }, [dispatch, onClose, pendingFile]);

  // Which image the panel currently shows:
  //   - pending pick's blob URL (before upload)
  //   - else the current avatar
  //   - else the glyph fallback
  const displayImage = previewUrl ?? avatarUrl ?? null;
  const hasPending = pendingFile !== null;

  // Primary button label depends on state:
  //   - uploading → "Uploading…"
  //   - pending pick → "Use this photo"
  //   - has current avatar → "Change photo"
  //   - no avatar yet → "Add photo"
  let primaryLabel: string;
  if (uploading) {
    primaryLabel = intl.formatMessage(messages.uploading);
  } else if (hasPending) {
    primaryLabel = intl.formatMessage(messages.uploadPhoto);
  } else if (avatarUrl) {
    primaryLabel = intl.formatMessage(messages.changePhoto);
  } else {
    primaryLabel = intl.formatMessage(messages.addPhoto);
  }

  const handlePrimaryClick = useCallback(() => {
    if (hasPending) {
      void confirmUpload();
    } else {
      openFilePicker();
    }
  }, [confirmUpload, hasPending, openFilePicker]);

  return (
    <div
      className='me-hub-avatar-preview'
      role='dialog'
      aria-modal='true'
      aria-label={displayName}
    >
      <button
        type='button'
        className='me-hub-avatar-preview__backdrop'
        onClick={onClose}
        aria-label='Close'
      />
      <div className='me-hub-avatar-preview__panel'>
        <div className='me-hub-avatar-preview__image'>
          {displayImage ? (
            <img
              src={displayImage}
              alt=''
              className='me-hub-avatar-preview__img'
            />
          ) : (
            <span className='me-hub-avatar-preview__glyph' aria-hidden>
              {glyph}
            </span>
          )}
        </div>
        <div className='me-hub-avatar-preview__details'>
          <div className='me-hub-avatar-preview__name'>{displayName}</div>
          {handle && (
            <div className='me-hub-avatar-preview__handle'>{handle}</div>
          )}
        </div>
        {/* Stats row wrapping the face: Mates / Posts / Joined. Uses
            the shared `<ShortNumber>` for K/M formatting. Joined year
            is a plain <FormattedDate> — falls back gracefully when
            `created_at` is missing. */}
        <dl className='me-hub-avatar-preview__stats'>
          <div className='me-hub-avatar-preview__stat'>
            <dt className='me-hub-avatar-preview__stat-label'>
              <FormattedMessage {...messages.statMates} />
            </dt>
            <dd className='me-hub-avatar-preview__stat-value'>
              <ShortNumber value={matesCount} />
            </dd>
          </div>
          <div className='me-hub-avatar-preview__stat'>
            <dt className='me-hub-avatar-preview__stat-label'>
              <FormattedMessage {...messages.statPosts} />
            </dt>
            <dd className='me-hub-avatar-preview__stat-value'>
              <ShortNumber value={postsCount} />
            </dd>
          </div>
          {joinedAt && (
            <div className='me-hub-avatar-preview__stat'>
              <dt className='me-hub-avatar-preview__stat-label'>
                <FormattedMessage {...messages.statJoined} />
              </dt>
              <dd className='me-hub-avatar-preview__stat-value'>
                <FormattedDate value={joinedAt} year='numeric' />
              </dd>
            </div>
          )}
        </dl>
        <div className='me-hub-avatar-preview__actions'>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='me-hub-avatar-preview__file-input'
            onChange={handleFileChange}
          />
          <button
            type='button'
            className='me-hub-avatar-preview__btn'
            onClick={handlePrimaryClick}
            disabled={uploading}
          >
            {primaryLabel}
          </button>
          {hasPending && !uploading && (
            <button
              type='button'
              className='me-hub-avatar-preview__btn me-hub-avatar-preview__btn--secondary'
              onClick={cancelPending}
            >
              <FormattedMessage {...messages.cancelPhoto} />
            </button>
          )}
          {uploadFailed && (
            <p className='me-hub-avatar-preview__error' role='alert'>
              <FormattedMessage {...messages.uploadFailed} />
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default MeHub;
