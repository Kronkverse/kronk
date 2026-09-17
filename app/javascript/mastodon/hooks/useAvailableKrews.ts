import { useEffect, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import { apiGetKrews } from 'mastodon/api/krew';
import type { KrewOption } from 'mastodon/components/reach_dropdown';

// Fetches the krews the viewer can post to (their own, unarchived) and shapes
// them for the ReachDropdown krew submenu / any additive-krew picker. One
// place so every composer gets the same list + filtering. Best-effort: on
// failure the list is empty and the composer stays usable.

const messages = defineMessages({
  members: {
    id: 'reach.krews.member_count',
    defaultMessage: '{count, plural, one {# member} other {# members}}',
  },
});

export const useAvailableKrews = (): KrewOption[] => {
  const intl = useIntl();
  const [krews, setKrews] = useState<KrewOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const list = await apiGetKrews({ scope: 'mine', limit: 100 });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `cancelled` is mutated in the cleanup after this await; TS can't see it across the closure.
        if (cancelled) return;
        setKrews(
          list
            .filter((k) => k.viewer_role !== null && !k.archived)
            .map((k) => ({
              id: k.id,
              name: k.name,
              hint: intl.formatMessage(messages.members, {
                count: k.member_count,
              }),
            })),
        );
      } catch {
        // Best-effort — leave the list empty.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [intl]);

  return krews;
};
