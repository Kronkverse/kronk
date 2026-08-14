/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { NavLink, useParams } from 'react-router-dom';

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import GlobeIcon from '@/material-icons/400-24px/globe.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import { fetchRelationships } from 'mastodon/actions/accounts';
import { importFetchedAccount } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiGetOwnProfileCards,
  apiGetProfileCards,
} from 'mastodon/api/profile_cards';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiGetOwnProfileSections,
  apiGetProfileSections,
} from 'mastodon/api/profile_sections';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { ArrangeStage } from './components/arrange_stage';
import { ProfileIdentityEditor } from './components/identity_editor';
import { ProfileHeader } from './components/profile_header';
import { ProfileViewerActions } from './components/profile_viewer_actions';
import { ShelvesStack } from './components/shelves_stack';

// Shelved profile — the rebuild of the sectioned profile per
// docs/spaces/profile.md and the 2026-08-01 questioning round.
// Renders at `/@:acct`, `/@:acct/profile`, and `/@:acct/shelves`.
// The old SectionedProfile retired 2026-08-01 — its 1626 lines +
// _sectioned_profile.scss are gone; `/@:acct/shelves` sticks around
// as an explicit alias for inbound links that were minted during
// the parallel development window.
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
  arrange: {
    id: 'profile_shelves.arrange_toggle',
    defaultMessage: 'Arrange',
  },
  view: {
    id: 'profile_shelves.view_toggle',
    defaultMessage: 'View',
  },
  logOut: {
    id: 'profile_shelves.log_out',
    defaultMessage: 'Log out',
  },
});

interface RouteParams {
  acct: string;
}

const ProfileShelves: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { acct } = useParams<RouteParams>();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [cards, setCards] = useState<ApiProfileCardJSON[] | null>(null);
  const [sections, setSections] = useState<ApiProfileSectionJSON[] | null>(
    null,
  );
  const [mode, setMode] = useState<'view' | 'arrange'>('view');
  const [error, setError] = useState(false);

  const isOwner = account !== null && account.id === me;

  useEffect(() => {
    let cancelled = false;
    setAccount(null);
    setCards(null);
    setSections(null);
    setMode('view');
    setError(false);

    void (async () => {
      try {
        const acctRes = await apiRequestGet<ApiAccountJSON>(
          `v1/accounts/lookup`,
          { acct },
        );
        if (cancelled) return;
        setAccount(acctRes);
        // Seed Redux so downstream components (FollowButton,
        // ProfileViewerActions) that read from `state.accounts`
        // find this account. The classic profile does this via its
        // own reducers; the shelved profile fetches locally and
        // has to relay the account explicitly. Also kick off the
        // relationship fetch — Mate/Nudge/More all depend on it.
        dispatch(importFetchedAccount(acctRes));
        if (acctRes.id !== me) {
          dispatch(fetchRelationships([acctRes.id]));
        }

        // Owner sees their own unfiltered content (visible: false rows,
        // self_only shelves); everyone else goes through the viewer path
        // which the server filters.
        const viewingSelf = acctRes.id === me;
        const [cardsRes, sectionsRes] = await Promise.all([
          (viewingSelf
            ? apiGetOwnProfileCards()
            : apiGetProfileCards(acctRes.id)
          ).catch(() => [] as ApiProfileCardJSON[]),
          (viewingSelf
            ? apiGetOwnProfileSections()
            : apiGetProfileSections(acctRes.id)
          ).catch(() => [] as ApiProfileSectionJSON[]),
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
  }, [acct, dispatch]);

  const handleArrangeChange = useCallback(
    (next: {
      cards: ApiProfileCardJSON[];
      sections: ApiProfileSectionJSON[];
    }) => {
      setCards(next.cards);
      setSections(next.sections);
    },
    [],
  );

  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'arrange' ? 'view' : 'arrange'));
  }, []);
  const enterArrange = useCallback(() => {
    setMode('arrange');
  }, []);

  // Owner-only affordance on the shelved profile header. The confirmation
  // modal (`CONFIRM_LOG_OUT`) already handles the DELETE /auth/sign_out
  // call via `mastodon/utils/log_out`. Same wiring used by the classic
  // navigation panel's "More" link + the compose overlay's account menu.
  const handleLogOut = useCallback(() => {
    dispatch(openModal({ modalType: 'CONFIRM_LOG_OUT', modalProps: {} }));
  }, [dispatch]);

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

  const loading = account === null || cards === null || sections === null;
  const nothingShown = !loading && cards.length === 0 && sections.length === 0;

  return (
    <Column bindToDocument label={title}>
      <ColumnBackButton />
      <Helmet>
        <title>{title}</title>
      </Helmet>

      {account && (
        <ProfileHeader
          account={account}
          actions={
            isOwner ? (
              <div className='profile-shelves__owner-actions'>
                <button
                  type='button'
                  className='profile-shelves__mode-toggle'
                  onClick={toggleMode}
                >
                  {mode === 'arrange'
                    ? intl.formatMessage(messages.view)
                    : intl.formatMessage(messages.arrange)}
                </button>
                <button
                  type='button'
                  className='profile-shelves__log-out'
                  onClick={handleLogOut}
                >
                  {intl.formatMessage(messages.logOut)}
                </button>
              </div>
            ) : (
              <ProfileViewerActions accountId={account.id} />
            )
          }
        />
      )}

      {/* Icon-only pillar strip. Labels ride as `aria-label` for
          screen readers + tooltips; the visible glyph carries the
          semantic. Site-wide direction from Tal (2026-08-04) is to
          prefer icon-only navigation on horizontal pillar strips —
          this is the first application; other pillar/tab surfaces
          (Kuestions panel tabs, Nudges lens tabs, korner sub-navs)
          follow in dedicated PRs so each surface picks its own
          glyphs deliberately. */}
      <nav className='profile-shelves__pillars' aria-label='Profile sections'>
        <NavLink
          to={`/@${acct}/shelves`}
          exact
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
          aria-label={intl.formatMessage(messages.pillarProfile)}
          title={intl.formatMessage(messages.pillarProfile)}
        >
          <Icon id='person' icon={PersonIcon} />
        </NavLink>
        <NavLink
          to={`/@${acct}/posts`}
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
          aria-label={intl.formatMessage(messages.pillarTimeline)}
          title={intl.formatMessage(messages.pillarTimeline)}
        >
          <Icon id='article' icon={ArticleIcon} />
        </NavLink>
        <NavLink
          to={`/@${acct}/mates`}
          className='profile-shelves__pillar'
          activeClassName='profile-shelves__pillar--active'
          aria-label={intl.formatMessage(messages.pillarKommunity)}
          title={intl.formatMessage(messages.pillarKommunity)}
        >
          <Icon id='globe' icon={GlobeIcon} />
        </NavLink>
      </nav>

      {loading ? (
        <div className='profile-shelves__loading'>
          {intl.formatMessage(messages.loading)}
        </div>
      ) : mode === 'arrange' && isOwner && account ? (
        <div className='profile-shelves__arrange'>
          <ProfileIdentityEditor />
          <ArrangeStage
            cards={cards ?? []}
            sections={sections ?? []}
            ownerAccountId={account.id}
            onChange={handleArrangeChange}
          />
        </div>
      ) : nothingShown ? (
        <div className='profile-shelves__empty'>
          {isOwner ? (
            <>
              <p>{intl.formatMessage(messages.emptyOwner)}</p>
              <button
                type='button'
                className='profile-shelves__mode-toggle'
                onClick={enterArrange}
              >
                {intl.formatMessage(messages.emptyOwnerCta)}
              </button>
            </>
          ) : (
            intl.formatMessage(messages.emptyViewer)
          )}
        </div>
      ) : account ? (
        <ShelvesStack
          accountId={account.id}
          cards={cards ?? []}
          sections={sections ?? []}
        />
      ) : null}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default ProfileShelves;
