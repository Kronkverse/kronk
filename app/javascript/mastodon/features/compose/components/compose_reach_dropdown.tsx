import { useCallback } from 'react';

import { changeComposeKrewTargets } from 'mastodon/actions/compose';
import { changeComposeVisibility } from 'mastodon/actions/compose_typed';
import type { StatusVisibility } from 'mastodon/api_types/statuses';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compose-store adapter for the ReachDropdown — the audience control in the
// composer header. Reads/writes the compose draft's `privacy`; the krew
// multi-select (KrewTargets) renders separately when `privacy === 'krew'`, so
// the submit path is unchanged. Mastodon's unlisted/private/direct are not
// offered — the Kronk ladder is the whole menu.

const LADDER: readonly ReachValue[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
  'krew',
];

interface Props {
  disabled?: boolean;
}

export const ComposeReachDropdown: React.FC<Props> = ({ disabled = false }) => {
  const dispatch = useAppDispatch();
  const privacy = useAppSelector(
    (state) => state.compose.get('privacy') as StatusVisibility,
  );

  const handleChange = useCallback(
    (value: ReachValue) => {
      dispatch(changeComposeVisibility(value));
      // Leaving Krew clears any krew targets so a stale list can't ride along.
      if (value !== 'krew') dispatch(changeComposeKrewTargets([]));
    },
    [dispatch],
  );

  // A reply can inherit a Mastodon visibility the Kronk ladder doesn't draw;
  // show it under the widest rung until the user picks, without changing the
  // stored value.
  const value: ReachValue = LADDER.includes(privacy as ReachValue)
    ? (privacy as ReachValue)
    : 'public';

  return (
    <ReachDropdown value={value} onChange={handleChange} disabled={disabled} />
  );
};
