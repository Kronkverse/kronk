import { useCallback, useMemo } from 'react';

import { List as ImmutableList } from 'immutable';

import { changeComposeKrewTargets } from 'mastodon/actions/compose';
import { changeComposeVisibility } from 'mastodon/actions/compose_typed';
import type { StatusVisibility } from 'mastodon/api_types/statuses';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compose-store adapter for the ReachDropdown — the audience control in the
// composer header. Reads/writes the compose draft's `privacy` (reach tier) and
// its `krew_ids` (the additive krew axis) independently: krew is no longer a
// visibility value (docs/rebuild/krew_axis_migration.md), so the krew submenu
// lives inside the dropdown and picking krews never touches the reach tier.
// Mastodon's unlisted/private/direct are not offered — the Kronk ladder is the
// whole menu.

// Reach tiers only — `krew` is retired as a rung (it's the additive submenu).
const LADDER: readonly ReachValue[] = ['self_only', 'mates', 'orbit', 'public'];

const HIDE_KREW_RUNG: readonly ReachValue[] = ['krew'];

interface Props {
  disabled?: boolean;
}

export const ComposeReachDropdown: React.FC<Props> = ({ disabled = false }) => {
  const dispatch = useAppDispatch();
  const privacy = useAppSelector(
    (state) => state.compose.get('privacy') as StatusVisibility,
  );
  const selectedKrewIds = useAppSelector((state) =>
    (
      (state.compose.get('krew_ids') ??
        ImmutableList()) as ImmutableList<string>
    ).toArray(),
  );
  const krews = useAvailableKrews();

  const handleChange = useCallback(
    (value: ReachValue) => {
      // Krew is orthogonal now — a reach change never touches krew_ids.
      dispatch(changeComposeVisibility(value));
    },
    [dispatch],
  );

  const handleToggleKrew = useCallback(
    (id: string) => {
      const next = selectedKrewIds.includes(id)
        ? selectedKrewIds.filter((x) => x !== id)
        : [...selectedKrewIds, id];
      dispatch(changeComposeKrewTargets(next));
    },
    [dispatch, selectedKrewIds],
  );

  // A reply can inherit a Mastodon visibility the Kronk ladder doesn't draw
  // (and legacy `krew` is no longer a rung); show it under the widest rung
  // until the user picks, without changing the stored value.
  const value: ReachValue = useMemo(
    () =>
      LADDER.includes(privacy as ReachValue)
        ? (privacy as ReachValue)
        : 'public',
    [privacy],
  );

  return (
    <ReachDropdown
      value={value}
      onChange={handleChange}
      disabled={disabled}
      hide={HIDE_KREW_RUNG}
      krews={krews}
      selectedKrewIds={selectedKrewIds}
      onToggleKrew={handleToggleKrew}
    />
  );
};
