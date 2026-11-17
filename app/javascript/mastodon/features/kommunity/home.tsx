import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import GroupsIcon from '@/material-icons/400-24px/groups.svg?react';
import OrbitIcon from '@/material-icons/400-24px/orbit.svg?react';
import ZheIcon from '@/material-icons/400-24px/zhe.svg?react';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { apiGetKommunityLayer } from 'mastodon/api/kommunity';
import type { KommunityLayer } from 'mastodon/api/kommunity';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Icon } from 'mastodon/components/icon';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { useAppDispatch } from 'mastodon/store';

import { KommunityEveryone } from './everyone';

// Kommunity's first page (Tal, 2026-11-17, Kommons "Kommunity Page"):
// one sideways row of people to discover, then everyone you can see,
// A to Z, each with where you stand as Mates. It took over from Discover
// (the three-deck drawer) and Everyone, which were tabs of their own.
//
// The row runs Orbit (your Mates' Mates), then your Krews, then
// Kronkers (everyone open to being found), each group led by a purple
// sign tile saying which it is, with a gap before it. Someone in more
// than one group shows once, in the first (a Mate of a Mate in your Krew
// is Orbit). Your Mates, and anyone you've already asked, are never in
// the row: the server leaves them out (LayersController). An empty group
// is left out, sign and all.

// The first page of each group is enough for a row; the list below has
// everyone.
const PER_GROUP = 20;

const GROUPS: KommunityLayer[] = ['orbit', 'krews', 'kronkers'];

const messages = defineMessages({
  discover: { id: 'kommunity.home.discover', defaultMessage: 'Discover' },
  everyone: { id: 'kommunity.home.everyone', defaultMessage: 'All Kronkers' },
  orbit: { id: 'kommunity.drawer.orbit', defaultMessage: 'Orbit' },
  orbitHint: {
    id: 'kommunity.home.orbit_hint',
    defaultMessage: 'Mates of your Mates',
  },
  krews: { id: 'kommunity.drawer.krews', defaultMessage: 'Krews' },
  krewsHint: {
    id: 'kommunity.home.krews_hint',
    defaultMessage: 'In your Krews',
  },
  kronkers: { id: 'kommunity.drawer.kronkers', defaultMessage: 'Kronkers' },
  kronkersHint: {
    id: 'kommunity.home.kronkers_hint',
    defaultMessage: 'Open to being found',
  },
});

const SIGNS = {
  orbit: { name: messages.orbit, hint: messages.orbitHint, icon: OrbitIcon },
  krews: { name: messages.krews, hint: messages.krewsHint, icon: GroupsIcon },
  kronkers: {
    name: messages.kronkers,
    hint: messages.kronkersHint,
    icon: ZheIcon,
  },
};

type Groups = { group: KommunityLayer; accounts: ApiAccountJSON[] }[];

// Each account in the first group it turns up in, groups in row order.
export const dedupeGroups = (groups: Groups): Groups => {
  const seen = new Set<string>();
  return groups.map(({ group, accounts }) => ({
    group,
    accounts: accounts.filter((account) => {
      if (seen.has(account.id)) return false;
      seen.add(account.id);
      return true;
    }),
  }));
};

const DiscoverRow: React.FC = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [groups, setGroups] = useState<Groups>([]);

  useEffect(() => {
    let cancelled = false;

    // A group that fails to load is left out rather than holding up the
    // others.
    void Promise.all(
      GROUPS.map((group) =>
        apiGetKommunityLayer(group, null, PER_GROUP)
          .then((accounts) => ({ group, accounts }))
          .catch(() => ({ group, accounts: [] as ApiAccountJSON[] })),
      ),
    ).then((loaded) => {
      if (cancelled) return;
      dispatch(importFetchedAccounts(loaded.flatMap((g) => g.accounts)));
      setGroups(dedupeGroups(loaded));
    });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const shown = groups.filter(({ accounts }) => accounts.length > 0);
  if (shown.length === 0) return null;

  const heading = intl.formatMessage(messages.discover);

  return (
    <section className='kommunity-home__discover' aria-label={heading}>
      <h2 className='korner-section-heading'>{heading}</h2>
      <SpaceGrid layout='row' className='kommunity-home__row'>
        {shown.flatMap(({ group, accounts }) => {
          const sign = SIGNS[group];
          return [
            <SpaceCard
              key={`sign-${group}`}
              tone='accent'
              placeholder={<Icon id={group} icon={sign.icon} />}
              title={intl.formatMessage(sign.name)}
              meta={intl.formatMessage(sign.hint)}
            />,
            ...accounts.map((account) => (
              <SpaceCard
                key={account.id}
                to={`/@${account.acct}`}
                image={account.avatar_static}
                title={account.display_name || account.username}
                meta={`@${account.acct}`}
              />
            )),
          ];
        })}
      </SpaceGrid>
    </section>
  );
};

export const KommunityHome: React.FC = () => {
  const intl = useIntl();

  return (
    <KommunityEveryone
      header={
        <>
          <DiscoverRow />
          <h2 className='korner-section-heading kommunity-home__everyone'>
            {intl.formatMessage(messages.everyone)}
          </h2>
        </>
      }
    />
  );
};
