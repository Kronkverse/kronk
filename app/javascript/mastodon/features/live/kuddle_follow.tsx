// Follow / Following on a Kuddle (a Huddle Room; docs/spaces/huddle.md,
// Following a Kuddle). Following one means a nudge when people gather in
// it. A Kuddle Konnected to one of your Krews is followed already; pressing
// Following stops it, and the server keeps that as your choice.

import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestPost } from 'mastodon/api';
import { KornerPill } from 'mastodon/components/korner_pill';

export interface KuddleFollowState {
  followed?: boolean;
  followed_via_krew?: boolean;
}

const messages = defineMessages({
  follow: { id: 'huddle.kuddle.follow', defaultMessage: 'Follow' },
  following: { id: 'huddle.kuddle.following', defaultMessage: 'Following' },
  followAria: {
    id: 'huddle.kuddle.follow_aria',
    defaultMessage:
      'Follow the {name} Kuddle, for a nudge when people gather in it',
  },
  unfollowAria: {
    id: 'huddle.kuddle.unfollow_aria',
    defaultMessage: 'Following the {name} Kuddle. Press to stop.',
  },
  unfollowKrewAria: {
    id: 'huddle.kuddle.unfollow_krew_aria',
    defaultMessage:
      'Following the {name} Kuddle, as one of your Krews. Press to stop.',
  },
});

interface Props {
  roomId: string;
  name: string;
  state: KuddleFollowState;
  onChange: (state: KuddleFollowState) => void;
  className?: string;
}

export const KuddleFollow: React.FC<Props> = ({
  roomId,
  name,
  state,
  onChange,
  className,
}) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const followed = state.followed ?? false;
  const viaKrew = state.followed_via_krew ?? false;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      const action = followed ? 'unfollow' : 'follow';
      void apiRequestPost<KuddleFollowState>(
        `v1/huddle/rooms/${roomId}/${action}`,
      )
        .then((updated) => {
          onChange({
            followed: updated.followed ?? !followed,
            followed_via_krew: updated.followed_via_krew ?? viaKrew,
          });
        })
        .catch(() => {
          // Nothing changed; the button still says what is true.
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [busy, followed, viaKrew, roomId, onChange],
  );

  let ariaLabel: string;
  if (!followed) {
    ariaLabel = intl.formatMessage(messages.followAria, { name });
  } else if (viaKrew) {
    ariaLabel = intl.formatMessage(messages.unfollowKrewAria, { name });
  } else {
    ariaLabel = intl.formatMessage(messages.unfollowAria, { name });
  }

  return (
    <KornerPill
      className={className}
      label={intl.formatMessage(
        followed ? messages.following : messages.follow,
      )}
      active={followed}
      disabled={busy}
      onClick={handleClick}
      ariaLabel={ariaLabel}
    />
  );
};
