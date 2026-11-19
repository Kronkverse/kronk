import { useCallback, useMemo } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { Map as ImmutableMap } from 'immutable';
import { List as ImmutableList } from 'immutable';

import {
  changeComposeAudienceExcludes,
  changeComposeAudienceGrants,
  changeComposeKrewTargets,
} from 'mastodon/actions/compose';
import { changeComposeVisibility } from 'mastodon/actions/compose_typed';
import type { StatusVisibility } from 'mastodon/api_types/statuses';
import type {
  AudiencePeople,
  PersonRef,
} from 'mastodon/components/audience_people_panel';
import type { ReachValue, SelfRung } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import { useAvailableKrews } from 'mastodon/hooks/useAvailableKrews';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Compose-store adapter for the ReachDropdown — the audience control in the
// composer header. Reads/writes the compose draft's `privacy` (reach tier) and
// its `krew_ids` (the additive krew axis) independently: krew is no longer a
// visibility value (docs/decisions.md), so the krew submenu
// lives inside the dropdown and picking krews never touches the reach tier.
// Mastodon's unlisted/private/direct are not offered — the Kronk ladder is the
// whole menu.

// On a Mate's profile (docs/spaces/profile.md, Posts from Mates) the
// narrowest rung is "Only on <name>'s profile" instead of Just me: the same
// `self_only`, which the profile then shows to whoever can see it. It goes to
// no feed, so it takes no Krews or people; the server drops any.
const messages = defineMessages({
  profileOnly: {
    id: 'reach.profile_only',
    defaultMessage: 'Only on {name}’s profile',
  },
  profileOnlyHint: {
    id: 'reach.profile_only_hint',
    defaultMessage: 'Not in anyone’s feed',
  },
});

// Reach tiers only — `krew` is the additive submenu, not a rung.
const LADDER: readonly ReachValue[] = ['self_only', 'mates', 'orbit', 'public'];

interface Props {
  disabled?: boolean;
}

export const ComposeReachDropdown: React.FC<Props> = ({ disabled = false }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const profileName = useAppSelector(
    (state) =>
      (
        state.compose.get('profile_target') as ImmutableMap<
          string,
          string
        > | null
      )?.get('name') ?? null,
  );
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

  // Per-post audience "people layer": the draft's added / removed people,
  // for the standard People panel in the dropdown.
  const grants = useAppSelector(
    (state) =>
      (state.compose.get('audience_grants') ??
        ImmutableList()) as ImmutableList<PersonRef>,
  );
  const excludes = useAppSelector(
    (state) =>
      (state.compose.get('audience_excludes') ??
        ImmutableList()) as ImmutableList<PersonRef>,
  );
  const people: AudiencePeople = useMemo(
    () => ({
      added: grants.toArray(),
      removed: excludes.toArray(),
    }),
    [grants, excludes],
  );
  const handlePeopleChange = useCallback(
    (next: AudiencePeople) => {
      dispatch(changeComposeAudienceGrants(next.added));
      dispatch(changeComposeAudienceExcludes(next.removed));
    },
    [dispatch],
  );

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

  const selfRung: SelfRung | undefined = useMemo(
    () =>
      profileName === null
        ? undefined
        : {
            label: intl.formatMessage(messages.profileOnly, {
              name: profileName,
            }),
            hint: intl.formatMessage(messages.profileOnlyHint),
          },
    [intl, profileName],
  );
  const profileOnly = selfRung !== undefined && value === 'self_only';

  return (
    <ReachDropdown
      value={value}
      onChange={handleChange}
      disabled={disabled}
      krews={profileOnly ? undefined : krews}
      selectedKrewIds={selectedKrewIds}
      onToggleKrew={handleToggleKrew}
      // People layer — the dropdown hides it for public (a public post
      // can't be restricted); hidden too for one only on a profile (the
      // profile decides).
      people={profileOnly ? undefined : people}
      onPeopleChange={handlePeopleChange}
      selfRung={selfRung}
    />
  );
};
