import { useCallback } from 'react';

import { List as ImmutableList } from 'immutable';

import { changeComposeKrewTargets } from 'mastodon/actions/compose';
import { changeComposeVisibility } from 'mastodon/actions/compose_typed';
import type { StatusVisibility } from 'mastodon/api_types/statuses';
import type { ReachValue } from 'mastodon/components/reach_selector';
import { ReachSelector } from 'mastodon/components/reach_selector';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compose-store adapter for the shared ReachSelector — the "who can see this?"
// control in the post composer. Reads/writes the compose draft's `privacy` +
// `krew_ids` (the same fields the old VisibilityButton modal + KrewTargets
// wrote), so the submit path is unchanged. Mastodon's unlisted/private/direct
// are intentionally not offered — the Kronk ladder is the whole menu.

const COMPOSE_REACH: readonly ReachValue[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
  'krew',
];

interface Props {
  disabled?: boolean;
}

export const ComposeReachSelector: React.FC<Props> = ({ disabled = false }) => {
  const dispatch = useAppDispatch();
  const privacy = useAppSelector(
    (state) => state.compose.get('privacy') as StatusVisibility,
  );
  const krewIds = useAppSelector((state) =>
    (
      (state.compose.get('krew_ids') ??
        ImmutableList()) as ImmutableList<string>
    ).toArray(),
  );

  const handleChange = useCallback(
    (value: ReachValue) => {
      dispatch(changeComposeVisibility(value));
      // Leaving Krew clears any krew targets so a stale list can't ride along
      // on a non-krew post.
      if (value !== 'krew') dispatch(changeComposeKrewTargets([]));
    },
    [dispatch],
  );

  const handleKrewIdsChange = useCallback(
    (ids: string[]) => {
      dispatch(changeComposeKrewTargets(ids));
    },
    [dispatch],
  );

  // A reply can inherit a Mastodon visibility (unlisted/private/direct) that the
  // Kronk ladder doesn't draw; show it under the widest rung until the user
  // picks, without changing the stored value.
  const value: ReachValue = COMPOSE_REACH.includes(privacy as ReachValue)
    ? (privacy as ReachValue)
    : 'public';

  return (
    <ReachSelector
      value={value}
      onChange={handleChange}
      krewIds={krewIds}
      onKrewIdsChange={handleKrewIdsChange}
      options={COMPOSE_REACH}
      disabled={disabled}
    />
  );
};
