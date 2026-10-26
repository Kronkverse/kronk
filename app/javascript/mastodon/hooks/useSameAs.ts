import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { audienceText } from 'mastodon/components/audience_marker';
import type {
  ReachValue,
  SameAsOption,
} from 'mastodon/components/reach_dropdown';
import type { KonnectControls, KonnectTarget } from 'mastodon/hooks/useKonnect';
import { konnectKey } from 'mastodon/hooks/useKonnect';
import { useRecordName } from 'mastodon/hooks/useRecordName';

// useSameAs — "Same as <record>" in a composer's Who sees this
// (docs/design.md, Konnect, "Same as"; decisions.md, 2026-10-25).
//
// A new record Konnected to something whose audience can be followed (the
// server says, per pending Konnection, in `konnect.audiences`) can take
// that audience and keep following it. The reach control offers "Same as
// <title>" for each such one; one at most leads. It is on by default when
// the composer opens from that record (`?konnect=`), or when the first
// such one is added before the person has touched reach. Choosing it
// copies the leader's tier and Krews into the composer's own reach, so the
// record is right the moment it's made; choosing any reach or Krew by hand
// turns it off. `konnect.commit` then asks for the leader's link with
// `metadata: { audience: 'same' }`, so the server keeps it following.
//
//   const konnect = useSameAs(useKonnect('cinema'), {...}).konnect
//   <ComposeShell konnect={konnect} headerAction={<ReachDropdown {...reach} />}>

interface UseSameAsOptions {
  // Off for an edit and where the composer's reach isn't its own (a Krew
  // album). Booth and korners without reach simply don't call this.
  enabled: boolean;
  // Put the leader's audience in the composer's reach: its tier, and its
  // Krews, or null to keep your own (an Everyone leader).
  apply: (tier: ReachValue, krewIds: string[] | null) => void;
  // The composer's own handlers; each turns Same as off.
  onChange: (value: ReachValue) => void;
  onToggleKrew?: (id: string) => void;
}

export interface SameAsReachProps {
  sameAs?: SameAsOption[];
  onSameAs: (key: string) => void;
  onChange: (value: ReachValue) => void;
  onToggleKrew?: (id: string) => void;
}

export const useSameAs = (
  konnect: KonnectControls,
  { enabled, apply, onChange, onToggleKrew }: UseSameAsOptions,
): { konnect: KonnectControls; reach: SameAsReachProps } => {
  const intl = useIntl();
  const names = useRecordName();
  const [leaderKey, setLeaderKey] = useState<string | null>(null);
  // Reach chosen by hand (or by a draft): no more defaulting.
  const [touched, setTouched] = useState(false);

  const { pending, audiences } = konnect;
  const candidates = useMemo(
    () =>
      enabled
        ? pending.filter((t) => audiences[konnectKey(t)]?.followable)
        : [],
    [enabled, pending, audiences],
  );
  const leader = useMemo(
    () => candidates.find((t) => konnectKey(t) === leaderKey) ?? null,
    [candidates, leaderKey],
  );

  useEffect(() => {
    if (touched || leader) return;
    const first = candidates[0];
    if (first) setLeaderKey(konnectKey(first));
  }, [touched, leader, candidates]);

  // Copy the leader's audience into the composer's reach.
  const currentKey = leader ? konnectKey(leader) : null;
  const leaderAudience = currentKey ? audiences[currentKey] : null;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (!currentKey || !leaderAudience?.tier) return;
    applyRef.current(
      leaderAudience.tier,
      leaderAudience.tier === 'public'
        ? null
        : leaderAudience.krews.map((k) => k.id),
    );
  }, [currentKey, leaderAudience]);

  const handleChange = useCallback(
    (value: ReachValue) => {
      setLeaderKey(null);
      setTouched(true);
      onChange(value);
    },
    [onChange],
  );
  const handleToggleKrew = useMemo(
    () =>
      onToggleKrew
        ? (id: string) => {
            setLeaderKey(null);
            setTouched(true);
            onToggleKrew(id);
          }
        : undefined,
    [onToggleKrew],
  );
  const handleSameAs = useCallback((key: string) => {
    setLeaderKey(key);
    setTouched(true);
  }, []);

  const sameAs = useMemo<SameAsOption[] | undefined>(
    () =>
      candidates.length > 0
        ? candidates.map((t) => {
            const key = konnectKey(t);
            const audience = audiences[key];
            return {
              key,
              // "Same as the Ember event": the title alone may be the Krew's too.
              title: names.the({ ...t, title: t.title ?? audience?.title }),
              audience: audienceText(intl, audience, t.slug, 'long') ?? '',
              selected: key === currentKey,
            };
          })
        : undefined,
    [candidates, audiences, currentKey, intl, names],
  );

  // A draft keeps which one leads, and puts it back.
  const { restore: restoreKonnect, saved: savedKonnect, commit } = konnect;
  const restore = useCallback(
    (saved: KonnectTarget[] | null | undefined) => {
      restoreKonnect(saved);
      const marked = saved?.find((t) => t.same);
      setLeaderKey(marked ? konnectKey(marked) : null);
      setTouched((saved?.length ?? 0) > 0);
    },
    [restoreKonnect],
  );
  const saved = useMemo(
    () =>
      currentKey
        ? savedKonnect.map((t) =>
            konnectKey(t) === currentKey ? { ...t, same: true } : t,
          )
        : savedKonnect,
    [savedKonnect, currentKey],
  );
  const commitFollowing = useCallback(
    (createdSlug: string, createdId: string) =>
      commit(createdSlug, createdId, leader),
    [commit, leader],
  );

  const controls = useMemo<KonnectControls>(
    () => ({ ...konnect, leader, restore, saved, commit: commitFollowing }),
    [konnect, leader, restore, saved, commitFollowing],
  );

  return {
    konnect: controls,
    reach: {
      sameAs,
      onSameAs: handleSameAs,
      onChange: handleChange,
      onToggleKrew: handleToggleKrew,
    },
  };
};
