// /me — the "Me" hub. Sits between the HubSwitcher's Me pillar and
// the user's public profile at `/@{username}`. A radial menu of
// self-related functions arrayed around the viewer's own avatar in
// the middle. Follows Tal's 2026-08-05 mockup.
//
// Not a full-featured settings surface — the shortcuts here are the
// six that mattered enough to earn a spoke:
//
//   * Profile   → /@{username}          (public profile view)
//   * Timeline  → /@{username}/posts    (their own posts stream,
//                                        matching the Timeline pillar
//                                        on the shelved profile)
//   * Mates     → /@{username}/mates    (mates list)
//   * Invite    → opens the invite modal (same modal that used to sit
//                                        in the top-right chrome —
//                                        that chrome button is now
//                                        retired since Me hub carries it)
//   * Switch    → placeholder for account-switcher (real UX in a
//                                        follow-up when multi-account
//                                        infrastructure lands)
//   * Sign out  → /auth/sign_out (Rails-served, DELETE)
//
// Two `?` slots on the ring are visible placeholders — the mockup
// shows them; keeping them makes the future extension obvious.
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
import { useHistory } from 'react-router-dom';

import GroupIcon from '@/material-icons/400-24px/group.svg?react';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';
import KeyIcon from '@/material-icons/400-24px/key.svg?react';
import LogoutIcon from '@/material-icons/400-24px/logout.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import QuestionMarkIcon from '@/material-icons/400-24px/question_mark.svg?react';
import SwapIcon from '@/material-icons/400-24px/sync_alt.svg?react';
import { importFetchedAccount } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import api from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Column } from 'mastodon/components/column';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';
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
  placeholder: { id: 'me_hub.placeholder', defaultMessage: 'Coming soon' },
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

// Spoke definitions in the render-order they appear around the ring.
// Positions are declared as angle (degrees, 0° = top, clockwise) so
// the CSS can compute placement uniformly with no per-spoke class.
interface Spoke {
  key: string;
  labelId: keyof typeof messages;
  icon: IconProp | null; // null = ? placeholder
  angle: number;
  // One of:
  //   `to`     — SPA route (uses history.push)
  //   `href`   — full-page nav (used for Rails-served /auth/sign_out)
  //   `action` — dispatch (invite modal, account-switcher modal)
  //   nothing  — inert placeholder
  to?: string;
  href?: string;
  action?: 'invite' | 'switch';
  method?: 'delete';
}

interface MeHubProps {
  // multiColumn / advancedInterface — kept for parity with other
  // top-level column components. Not consumed today.
  multiColumn?: boolean;
}

export const MeHub: React.FC<MeHubProps> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
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

  // Spokes clockwise from top. Two `?` placeholders inherit the
  // `placeholder` label + null icon; they render but don't act.
  const spokes: Spoke[] = [
    {
      key: 'profile',
      labelId: 'profile',
      icon: PersonIcon,
      angle: 0,
      to: profilePath,
    },
    {
      key: 'mates',
      labelId: 'mates',
      icon: GroupIcon,
      angle: 45,
      to: matesPath,
    },
    { key: 'ph-e', labelId: 'placeholder', icon: null, angle: 90 },
    {
      key: 'switch',
      labelId: 'switchAccount',
      icon: SwapIcon,
      angle: 135,
      action: 'switch',
    },
    {
      key: 'signout',
      labelId: 'signOut',
      icon: LogoutIcon,
      angle: 180,
      href: '/auth/sign_out',
      method: 'delete',
    },
    {
      key: 'invite',
      labelId: 'invite',
      icon: KeyIcon,
      angle: 225,
      action: 'invite',
    },
    { key: 'ph-w', labelId: 'placeholder', icon: null, angle: 270 },
    {
      key: 'timeline',
      labelId: 'timeline',
      icon: HistoryIcon,
      angle: 315,
      to: timelinePath,
    },
  ];

  // The center avatar used to navigate to the profile page — but the
  // Profile spoke already goes there, so the two affordances were
  // redundant. Instead, tapping the face opens the avatar itself at
  // size (with the display name + handle as detail). See the
  // <AvatarPreview> overlay below.
  const handleCenterClick = openAvatar;

  const handleSpokeClick = useCallback(
    (spoke: Spoke) => {
      if (spoke.action === 'invite') {
        dispatch(openModal({ modalType: 'INVITE', modalProps: {} }));
      } else if (spoke.action === 'switch') {
        dispatch(openModal({ modalType: 'ACCOUNT_SWITCHER', modalProps: {} }));
      } else if (spoke.to) {
        history.push(spoke.to);
      }
      // `href` spokes are anchors — the click's default navigation
      // handles them (no explicit action here).
    },
    [dispatch, history],
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
            centers wheel/hint inside it. */}
        <div className='me-hub__stack'>
          <div className='me-hub__wheel'>
            {/* Dashed connector ring — decorative, purely visual link
                between the spokes. `aria-hidden` because it carries no
                meaning for AT. */}
            <div className='me-hub__ring' aria-hidden />

            {/* Center: avatar or initial. Tapping opens the avatar
                preview overlay (see below) — the Profile spoke is
                the affordance for navigating to the profile page. */}
            <button
              type='button'
              className='me-hub__center'
              onClick={handleCenterClick}
              aria-label={intl.formatMessage(messages.profile)}
            >
              {myAccount?.avatar ? (
                <img
                  src={myAccount.avatar}
                  alt=''
                  aria-hidden
                  className='me-hub__center-avatar'
                />
              ) : (
                <span className='me-hub__center-glyph' aria-hidden>
                  {displayGlyph}
                </span>
              )}
            </button>

            {spokes.map((spoke) => (
              <Spoke
                key={spoke.key}
                spoke={spoke}
                label={intl.formatMessage(messages[spoke.labelId])}
                onClick={handleSpokeClick}
              />
            ))}
          </div>

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

interface SpokeProps {
  spoke: Spoke;
  label: string;
  onClick: (spoke: Spoke) => void;
}

const Spoke: React.FC<SpokeProps> = ({ spoke, label, onClick }) => {
  const isPlaceholder = spoke.icon === null && !spoke.to && !spoke.href;
  const IconComponent = spoke.icon ?? QuestionMarkIcon;
  const handleClick = useCallback(() => {
    if (isPlaceholder) return;
    onClick(spoke);
  }, [isPlaceholder, onClick, spoke]);

  const style = {
    // Ring geometry — CSS puts each spoke at `angle` around the wheel.
    // Radius is a CSS variable in `_me_hub.scss` so the layout can
    // breathe responsively.
    '--spoke-angle': `${String(spoke.angle)}deg`,
  } as React.CSSProperties;

  const className = `me-hub__spoke${isPlaceholder ? ' me-hub__spoke--placeholder' : ''}`;

  // `href` spokes render as plain <a> so full-page nav + optional
  // data-method delete (Rails UJS: sign-out) work as they do on any
  // static-chrome link. Everything else renders as a button.
  if (spoke.href) {
    return (
      <a
        href={spoke.href}
        className={className}
        style={style}
        data-method={spoke.method}
      >
        <SpokeInner icon={IconComponent} label={label} spokeKey={spoke.key} />
      </a>
    );
  }

  return (
    <button
      type='button'
      className={className}
      style={style}
      onClick={handleClick}
      disabled={isPlaceholder}
      aria-disabled={isPlaceholder || undefined}
    >
      <SpokeInner icon={IconComponent} label={label} spokeKey={spoke.key} />
    </button>
  );
};

interface SpokeInnerProps {
  icon: IconProp;
  label: string;
  spokeKey: string;
}

const SpokeInner: React.FC<SpokeInnerProps> = ({ icon, label, spokeKey }) => (
  <>
    <span className='me-hub__spoke-bubble' aria-hidden>
      <Icon id={spokeKey} icon={icon} className='me-hub__spoke-icon' />
    </span>
    <span className='me-hub__spoke-label'>{label}</span>
  </>
);

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default MeHub;
