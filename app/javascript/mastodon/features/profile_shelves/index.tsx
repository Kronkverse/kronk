/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

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
import { AccountBio } from 'mastodon/components/account_bio';
import { AccountNote } from 'mastodon/features/account/components/account_note';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { ArrangeStack } from './components/arrange_stack';
import { ProfileIdentityEditor } from './components/identity_editor';
import { ProfileBoard } from './components/profile_board';
import { ProfileMeta } from './components/profile_meta';

// The Profile face — the first face of the profile drum, at `/@:acct`.
//
// Was the whole shelved-profile page (its own Column, header and
// icon strip). Since 2026-09-15 the space owns that chrome: this is
// the body alone, and `features/profile/index.tsx` renders it inside
// the drum with the block pinned above. Per
// docs/spaces/profile.md it leads with the person — their note, bio,
// joined date and fields — and then their sections.
// The old SectionedProfile retired 2026-08-01 — its 1626 lines +
// _sectioned_profile.scss are gone.
//
// Arrange (owner-only) lives on this face's own toolbar rather than in
// the block: it arranges *this* face's content, and the block is only
// identity now.

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
  identity: {
    id: 'profile_shelves.identity_toggle',
    defaultMessage: 'Name, photo and fields',
  },
  identityDone: {
    id: 'profile_shelves.identity_done',
    defaultMessage: 'Done editing',
  },
});

interface Props {
  acct: string;
}

export const ProfileFace: React.FC<Props> = ({ acct }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [cards, setCards] = useState<ApiProfileCardJSON[] | null>(null);
  const [sections, setSections] = useState<ApiProfileSectionJSON[] | null>(
    null,
  );
  const [mode, setMode] = useState<'view' | 'arrange'>('view');
  // Identity editing is a form, and a form is the one thing that cannot be
  // done in place on the rendered profile. It stays folded away so that what
  // Arrange shows, by default, is the profile itself.
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [error, setError] = useState(false);

  const isOwner = account !== null && account.id === me;

  useEffect(() => {
    let cancelled = false;
    setAccount(null);
    setCards(null);
    setSections(null);
    setMode('view');
    setEditingIdentity(false);
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

  const handleCardsChange = useCallback((next: ApiProfileCardJSON[]) => {
    setCards(next);
  }, []);

  const handleSectionsChange = useCallback((next: ApiProfileSectionJSON[]) => {
    setSections(next);
  }, []);

  const toggleIdentity = useCallback(() => {
    setEditingIdentity((current) => !current);
  }, []);

  // Refetch the owner's cards + sections. The Fields editor and Section
  // selector manage their own copies and don't push edits back up here, so
  // the View (which renders from this state) would otherwise show stale data
  // until a page reload.
  const refreshOwnContent = useCallback(() => {
    if (!isOwner) return;
    void Promise.all([
      apiGetOwnProfileCards().catch(() => [] as ApiProfileCardJSON[]),
      apiGetOwnProfileSections().catch(() => [] as ApiProfileSectionJSON[]),
    ]).then(([nextCards, nextSections]) => {
      setCards(nextCards);
      setSections(nextSections);
      return undefined;
    });
  }, [isOwner]);

  const toggleMode = useCallback(() => {
    // Leaving Arrange → pull fresh content so edits show in View immediately.
    if (mode === 'arrange') refreshOwnContent();
    setMode((current) => (current === 'arrange' ? 'view' : 'arrange'));
  }, [mode, refreshOwnContent]);
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

  if (error) {
    return (
      <div className='profile-shelves__empty'>
        {intl.formatMessage(messages.notFound)}
      </div>
    );
  }

  const loading = account === null || cards === null || sections === null;
  const nothingShown = !loading && cards.length === 0 && sections.length === 0;

  return (
    <div className='profile-face'>
      {/* Owner toolbar. Arrange belongs to this face, not to the block:
          it rearranges what is on the face. Identity editing folds open
          below, inside Arrange. */}
      {account && isOwner && (
        <div className='profile-shelves__edit-toolbar'>
          <button
            type='button'
            className='profile-shelves__mode-toggle'
            onClick={toggleMode}
          >
            {intl.formatMessage(
              mode === 'arrange' ? messages.view : messages.arrange,
            )}
          </button>
          <button
            type='button'
            className='profile-shelves__log-out'
            onClick={handleLogOut}
          >
            {intl.formatMessage(messages.logOut)}
          </button>
        </div>
      )}

      {/* The person, before their shelves: personal note, bio, joined
          date and profile fields. This is what came out of the legacy
          header when the block was standardised (2026-09-15). */}
      {account && !isOwner && <AccountNote accountId={account.id} />}
      {account && (
        <AccountBio accountId={account.id} className='profile-face__bio' />
      )}
      {account && <ProfileMeta accountId={account.id} />}

      {loading ? (
        <div className='profile-shelves__loading'>
          {intl.formatMessage(messages.loading)}
        </div>
      ) : mode === 'arrange' && isOwner && account ? (
        // Arrange IS the profile. Same page, same tiles, same shelves, same
        // order — held to lift, dragged to move, with a + at the end. The
        // only thing not rendered in place is the identity form, which folds
        // open, because a form is the one thing that can't be edited on the
        // rendered page.
        <div className='profile-shelves__arrange'>
          <div className='profile-arrange__tools'>
            <button
              type='button'
              className='profile-arrange__tool'
              onClick={toggleIdentity}
              aria-expanded={editingIdentity}
            >
              {intl.formatMessage(
                editingIdentity ? messages.identityDone : messages.identity,
              )}
            </button>
          </div>

          {editingIdentity && <ProfileIdentityEditor />}

          <ProfileBoard
            accountId={account.id}
            cards={cards ?? []}
            sections={[]}
            arrange
            onCardsChange={handleCardsChange}
          />

          <ArrangeStack
            accountId={account.id}
            sections={sections ?? []}
            onChange={handleSectionsChange}
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
        <ProfileBoard
          accountId={account.id}
          cards={cards ?? []}
          sections={sections ?? []}
        />
      ) : null}
    </div>
  );
};
