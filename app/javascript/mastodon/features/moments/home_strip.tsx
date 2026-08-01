// Home top strip — horizontal row of ring-avatars at the top of Home
// showing the viewer's + their mates' active Moments (per
// docs/spaces/moments.md § Where you see Moments). Newest first,
// owner tile on the left. Empty state = compose CTA. Clicking a ring
// opens the composer (owner tile) or navigates to /hub/moments (any
// other ring, until the deep-link viewer ships).

import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { setKornerSeen } from 'mastodon/actions/korners';
import { apiRequestGet } from 'mastodon/api';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

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

  return (
    <button
      type='button'
      className={`moments-strip__ring${isOwner ? ' moments-strip__ring--owner' : ''}${moment ? ' moments-strip__ring--has-moment' : ''}${moment && seen ? ' moments-strip__ring--seen' : ''}`}
      onClick={handleClick}
      aria-label={`${account.display_name || account.acct}${moment ? ' has an active Moment' : ' — add a Moment'}`}
    >
      <span className='moments-strip__ring-avatar'>
        <img src={account.avatar || account.avatar_static} alt='' aria-hidden />
        {isOwner && !ownerHasMoment && (
          <span className='moments-strip__ring-add' aria-hidden>
            +
          </span>
        )}
      </span>
      <span className='moments-strip__ring-label'>
        {isOwner ? (
          <FormattedMessage
            id='moments.strip.your_moment'
            defaultMessage='Your Moment'
          />
        ) : (
          `@${account.acct}`
        )}
      </span>
    </button>
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
  const history = useHistory();
  const dispatch = useAppDispatch();
  const momentsKorner = useKorner('moments');
  const tunedOut = momentsKorner?.tuned_in === false;

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
  if (loading && moments.length === 0) return null; // avoid a flash for one-frame render

  // Split viewer's own moment (if any) from mates' moments so the
  // owner tile can render leftmost regardless of newest-first ordering.
  const ownMoment = moments.find((m) => m.account.id === me);
  const mateMoments = moments.filter((m) => m.account.id !== me);

  const ownerAccount: AccountJSON = ownMoment?.account ?? {
    id: me ?? '',
    acct: '',
    display_name: '',
    // If the viewer hasn't posted a Moment, the strip still needs an
    // owner tile to invite them to post one. The avatar url will be
    // filled by the browser cache if visited; empty string falls
    // back to the default avatar via the img error handler.
    avatar: '',
    avatar_static: '',
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
