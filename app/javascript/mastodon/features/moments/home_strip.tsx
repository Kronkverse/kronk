// Home top strip — horizontal row of ring-avatars at the top of Home
// showing the viewer's + their mates' active Moments (per
// docs/spaces/moments.md § Where you see Moments). Newest first,
// owner tile on the left. Empty state = compose CTA. Clicking a ring
// opens the composer (owner tile) or navigates to /hub/moments (any
// other ring, until the deep-link viewer ships).

import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import { me } from 'mastodon/initial_state';

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
}

interface RingProps {
  account: AccountJSON;
  moment?: MomentJSON;
  isOwner: boolean;
  ownerHasMoment: boolean;
  onCompose: () => void;
  onOpen: (moment: MomentJSON) => void;
}

const Ring = ({
  account,
  moment,
  isOwner,
  ownerHasMoment,
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
      className={`moments-strip__ring${isOwner ? ' moments-strip__ring--owner' : ''}${moment ? ' moments-strip__ring--has-moment' : ''}`}
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
  const history = useHistory();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequestGet<MomentJSON[]>('v1/moments', { scope: 'mates' })
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
      // Deep-link viewer not built yet — jump to the korner grid for
      // now. Follow-up PR wires /hub/moments/:id.
      history.push(`/hub/moments`);
      void moment; // unused until deep link exists
    },
    [history],
  );

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
