/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { NavLink, useParams } from 'react-router-dom';

import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import { apiGetProfileCards } from 'mastodon/api/profile_cards';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import { apiGetProfileSections } from 'mastodon/api/profile_sections';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';

import { ProfileHeader } from './components/profile_header';
import { ShelvesStack } from './components/shelves_stack';

// Shelved profile — the rebuild of the sectioned profile per
// docs/spaces/profile.md and the 2026-08-01 questioning round. The
// route mounts at `/@:acct/shelves` in parallel with the existing
// SectionedProfile so both can be developed side-by-side; the older
// route retires once the shelved surface reaches parity.
//
// The page has three pillars in the membrane:
//
//   Profile     — this component. Stack of told cards + drawn shelves.
//   Timeline    — chronological account timeline; renders under the
//                 existing AccountTimeline route.
//   Kommunity   — the community-as-timeline view under /@user/mates.
//
// The pillars render as NavLinks; the active state derives from the
// URL so a browser back/forward keeps them in sync.

const messages = defineMessages({
  title: { id: 'profile_shelves.title', defaultMessage: 'Profile' },
  pillarProfile: {
    id: 'profile_shelves.pillars.profile',
    defaultMessage: 'Profile',
  },
  pillarTimeline: {
    id: 'profile_shelves.pillars.timeline',
    defaultMessage: 'Timeline',
  },
  pillarKommunity: {
    id: 'profile_shelves.pillars.kommunity',
    defaultMessage: 'Kommunity',
  },
  loading: {
    id: 'profile_shelves.loading',
    defaultMessage: 'Loading…',
  },
  emptyOwner: {
    id: 'profile_shelves.empty_owner',
    defaultMessage: 'Nothing on the shelves yet.',
  },
  emptyOwnerCta: {
    id: 'profile_shelves.empty_owner_cta',
    defaultMessage: 'Arrange your profile',
  },
  emptyViewer: {
    id: 'profile_shelves.empty_viewer',
    defaultMessage: 'This profile is quiet.',
  },
  notFound: {
    id: 'profile_shelves.not_found',
    defaultMessage: "We couldn't find that profile.",
  },
});

interface RouteParams {
  acct: string;
}

const ProfileShelves: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { acct } = useParams<RouteParams>();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [cards, setCards] = useState<ApiProfileCardJSON[] | null>(null);
  const [sections, setSections] = useState<ApiProfileSectionJSON[] | null>(
    null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAccount(null);
    setCards(null);
    setSections(null);
    setError(false);

    void (async () => {
      try {
        const acctRes = await apiRequestGet<ApiAccountJSON>(
          `v1/accounts/lookup`,
          { acct },
        );
        if (cancelled) return;
        setAccount(acctRes);

        const [cardsRes, sectionsRes] = await Promise.all([
          apiGetProfileCards(acctRes.id).catch(() => [] as ApiProfileCardJSON[]),
          apiGetProfileSections(acctRes.id).catch(
            () => [] as ApiProfileSectionJSON[],
          ),
        ]);
        if (cancelled) return;
        setCards(cardsRes);
        setSections(sectionsRes);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct]);

  const title = intl.formatMessage(messages.title);

  if (error) {
    return (
      <Column bindToDocument>
        <ColumnBackButton />
        <div className='profile-shelves__empty'>
          {intl.formatMessage(messages.notFound)}
        </div>
      </Column>
    );
  }

  const loading =
    account === null || cards === null || sections === null;
  const nothingShown =
    !loading && cards.length === 0 && sections.length === 0;

  return (
    <Column bindToDocument label={title}>
      <ColumnBackButton />
      <Helmet>
        <title>{title}</title>
      </Helmet>

      {account && <ProfileHeader account={account} />}

      <nav className='profile-shelves__pillars' aria-label='Profile sections'>
        <NavLink
          to={`/@${acct}/shelves`}
          exact
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
        >
          <FormattedMessage {...messages.pillarProfile} />
        </NavLink>
        <NavLink
          to={`/@${acct}/posts`}
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
        >
          <FormattedMessage {...messages.pillarTimeline} />
        </NavLink>
        <NavLink
          to={`/@${acct}/mates`}
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
        >
          <FormattedMessage {...messages.pillarKommunity} />
        </NavLink>
      </nav>

      {loading ? (
        <div className='profile-shelves__loading'>
          {intl.formatMessage(messages.loading)}
        </div>
      ) : nothingShown ? (
        <div className='profile-shelves__empty'>
          {intl.formatMessage(messages.emptyViewer)}
        </div>
      ) : (
        <ShelvesStack cards={cards ?? []} sections={sections ?? []} />
      )}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default ProfileShelves;
