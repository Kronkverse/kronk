// Home top strip — horizontal row of ring-avatars at the top of Home
// showing the viewer's + their mates' active Moments (per
// docs/spaces/moments.md § Where you see Moments). Newest first,
// owner tile on the left. Empty state = compose CTA. Clicking a ring
// opens the composer (owner tile) or navigates to /hub/moments (any
// other ring, until the deep-link viewer ships).

import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import { setKornerSeen } from 'mastodon/actions/korners';
import { apiRequestGet } from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { MomentsComposer } from './composer';

interface AccountJSON {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
  avatar_static: string;
}

interface MediaJSON {
  id: string;
  preview_url: string;
  type: string;
}

interface MomentJSON {
  id: string;
  caption: string | null;
  expires_at: string;
  active: boolean;
  account: AccountJSON;
  media_attachment: MediaJSON;
  // Whether the viewer has already seen this Moment (viewed or frothed) — its
  // ring renders dim rather than bright. See lib/kronk/korner_seen.rb.
  seen_by_viewer?: boolean;
  // Populated only for photo+voice Moments — drives the mic-glyph
  // indicator on the ring (spec § Where you see Moments). The
  // viewer uses this same field to render the <VoicePlayer> overlay.
  voice_url?: string | null;
}

interface RingProps {
  account: AccountJSON;
  moment?: MomentJSON;
  isOwner: boolean;
  ownerHasMoment: boolean;
  seen: boolean;
  onCompose: () => void;
  onOpen: (moment: MomentJSON) => void;
}

const Ring = ({
  account,
  moment,
  isOwner,
  ownerHasMoment,
  seen,
  onCompose,
  onOpen,
}: RingProps) => {
  const handleClick = useCallback(() => {
    if (isOwner && !ownerHasMoment) {
      onCompose();
    } else if (moment) {
      onOpen(moment);
    }
  }, [isOwner, ownerHasMoment, moment, onCompose, onOpen]);

  const handleAddClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCompose();
    },
    [onCompose],
  );

  // Tile image: preview the moment's media when there IS one — for
  // every tile, owner or mate. Previously mates showed only the
  // avatar (Instagram-Stories convention: ring = live moment, avatar
  // = who posted), but kronky flagged this on Kommons #117047187124512791
  // — the strip is more useful when the *photo you'll open* is what
  // you see. Falls back to the account avatar when the tile has no
  // Moment yet (owner-with-nothing-posted case).
  const tileImage = moment
    ? moment.media_attachment.preview_url
    : account.avatar || account.avatar_static;
  // Show the `+` add-affordance on the owner tile in both cases: no
  // Moment yet (primary CTA), OR the owner already has one but might
  // want to post another (answers the "how do I add a second?"
  // discoverability gap). Rendered as a sibling button in a `<div>`
  // wrapper so we don't nest buttons.
  const showAddBadge = isOwner;

  const innerFace = (
    <>
      <span className='moments-strip__ring-avatar'>
        <img src={tileImage} alt='' aria-hidden />
        {moment?.voice_url && (
          <span
            className='moments-strip__ring-voice'
            aria-label='has voice'
            title='has voice'
          >
            <Icon id='mic' icon={MicIcon} />
          </span>
        )}
      </span>
      <span className='moments-strip__ring-label'>
        {isOwner ? (
          <FormattedMessage
            id='moments.strip.owner_label'
            defaultMessage='Moments'
          />
        ) : (
          `@${account.acct}`
        )}
      </span>
    </>
  );

  const ringClassName = `moments-strip__ring${isOwner ? ' moments-strip__ring--owner' : ''}${moment ? ' moments-strip__ring--has-moment' : ''}${moment && seen ? ' moments-strip__ring--seen' : ''}`;

  const ringButton = (
    <button
      type='button'
      className={ringClassName}
      onClick={handleClick}
      aria-label={`${account.display_name || account.acct}${moment ? ' has an active Moment' : ' — add a Moment'}`}
    >
      {innerFace}
    </button>
  );

  // Mate tile: no wrapper — the button is the whole thing.
  if (!showAddBadge) return ringButton;

  // Owner tile: wrap in a layout-neutral positioning slot so the `+`
  // add-Moment button can sit as an absolutely-positioned sibling
  // without nesting inside the ring button (invalid HTML). The slot's
  // only jobs are being a `position: relative` anchor and sizing to
  // its child button — no flex, no padding, no border of its own.
  return (
    <div className='moments-strip__ring-slot'>
      {ringButton}
      <button
        type='button'
        className='moments-strip__ring-add'
        onClick={handleAddClick}
        aria-label={moment ? 'Post another Moment' : 'Post a Moment'}
        title={moment ? 'Post another' : 'Post a Moment'}
      >
        +
      </button>
    </div>
  );
};

export const MomentsStrip = () => {
  const [moments, setMoments] = useState<MomentJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  // Moments seen optimistically this session (opened in the viewer), so their
  // rings dim immediately without waiting for a refetch. Merged with the
  // server's seen_by_viewer.
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  // User's `moments_strip_on_home` preference (Feed Settings, Tal
  // 2026-09-05). Undefined while the fetch is in flight → treat as
  // true (default) so the strip doesn't flash-hide before the setting
  // resolves. Fetch once on mount; the setting rarely changes and a
  // refresh picks up any new value.
  const [stripOn, setStripOn] = useState<boolean>(true);
  const history = useHistory();
  const dispatch = useAppDispatch();
  const momentsKorner = useKorner('moments');
  const tunedOut = momentsKorner?.tuned_in === false;

  useEffect(() => {
    let cancelled = false;
    apiRequestGet<{ values: { moments_strip_on_home?: boolean } }>(
      'v1/settings/feed',
    )
      .then((data) => {
        if (cancelled) return;
        setStripOn(data.values.moments_strip_on_home !== false);
      })
      .catch(() => {
        // Non-fatal — fall through to the default (strip on).
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Viewer's own account — used to render the owner tile's avatar
  // when they haven't posted a Moment yet. Was previously an empty
  // string (broken image) because the strip only fetches Moments,
  // not accounts.
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequestGet<MomentJSON[]>('v1/moments', { filter: 'active' })
      .then((data) => {
        if (cancelled) return;
        setMoments(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const openComposer = useCallback(() => {
    setShowComposer(true);
  }, []);
  const closeComposer = useCallback(() => {
    setShowComposer(false);
  }, []);
  const onPosted = useCallback(() => {
    setShowComposer(false);
    setRefreshTick((n) => n + 1);
  }, []);

  const openViewer = useCallback(
    (moment: MomentJSON) => {
      // Viewing a Moment marks it seen: dim its ring now (optimistic) and tick
      // the Moments badge down by one. The server records it on GET show.
      if (!moment.seen_by_viewer && !seenIds.has(moment.id)) {
        setSeenIds((prev) => new Set(prev).add(moment.id));
        dispatch(setKornerSeen({ slug: 'moments' }));
      }
      history.push(`/hub/moments/${moment.id}`);
    },
    [history, dispatch, seenIds],
  );

  const isSeen = useCallback(
    (moment: MomentJSON) =>
      Boolean(moment.seen_by_viewer) || seenIds.has(moment.id),
    [seenIds],
  );

  // Tuned out of Moments → no strip on Home (the korner tune-in gate).
  if (tunedOut) return null;
  // User has hidden the strip via Feed Settings (independent of
  // tune-in — tune-in is "cards in feed"; strip-on-home is "strip
  // above the feed").
  if (!stripOn) return null;
  if (loading && moments.length === 0) return null; // avoid a flash for one-frame render

  // Split viewer's own moment (if any) from mates' moments so the
  // owner tile can render leftmost regardless of newest-first ordering.
  const ownMoment = moments.find((m) => m.account.id === me);
  const mateMoments = moments.filter((m) => m.account.id !== me);

  const ownerAccount: AccountJSON = ownMoment?.account ?? {
    id: me ?? '',
    acct: myAccount?.acct ?? '',
    display_name: myAccount?.display_name ?? '',
    // Viewer's actual avatar from the Redux store so the owner tile
    // shows their profile picture when no Moment exists yet — per
    // Tal's spec: "hold the user's profile picture until they
    // upload a moment, in which it should preview that moment".
    // Empty string only if the accounts slice hasn't hydrated yet;
    // the `img` element's onError handler could add a fallback but
    // in practice the accounts slice is populated at boot for the
    // signed-in user.
    avatar: myAccount?.avatar ?? '',
    avatar_static: myAccount?.avatar_static ?? '',
  };

  return (
    <div className='moments-strip' aria-label='Moments'>
      <div className='moments-strip__scroller'>
        <Ring
          account={ownerAccount}
          moment={ownMoment}
          isOwner
          ownerHasMoment={!!ownMoment}
          seen={false}
          onCompose={openComposer}
          onOpen={openViewer}
        />
        {mateMoments.map((moment) => (
          <Ring
            key={moment.id}
            account={moment.account}
            moment={moment}
            isOwner={false}
            ownerHasMoment={false}
            seen={isSeen(moment)}
            onCompose={openComposer}
            onOpen={openViewer}
          />
        ))}
      </div>
      {showComposer && (
        <MomentsComposer onClose={closeComposer} onPosted={onPosted} />
      )}
    </div>
  );
};
