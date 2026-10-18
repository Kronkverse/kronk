/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { fetchRelationships } from 'mastodon/actions/accounts';
import { importFetchedAccount } from 'mastodon/actions/importer';
import { apiRequestGet } from 'mastodon/api';
import { apiGetPinnedKuestions } from 'mastodon/api/kuestions';
import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiGetOwnProfileCards,
  apiGetProfileCards,
} from 'mastodon/api/profile_cards';
import type {
  ApiProfileSectionJSON,
  ProfileAudience,
} from 'mastodon/api/profile_sections';
import {
  apiGetOwnProfileSections,
  apiGetProfileSections,
} from 'mastodon/api/profile_sections';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import type { ApiPinnedKuestionJSON } from 'mastodon/api_types/kuestions';
import { KornerPill } from 'mastodon/components/korner_pill';
import { ProfilePanel } from 'mastodon/features/questions/profile_panel';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { ArrangeStack } from './components/arrange_stack';
import { ProfileBoard } from './components/profile_board';
import { ProfileMeta } from './components/profile_meta';
import { ProfilePrompts } from './components/profile_prompts';
import { PROFILE_FIELD_BY_KEY } from './profile_field_catalog';

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
  emptyViewer: {
    id: 'profile_shelves.empty_viewer',
    defaultMessage: 'This profile is quiet.',
  },
  emptyViewAs: {
    id: 'profile_shelves.empty_view_as',
    defaultMessage: 'Nothing on your profile reaches them.',
  },
  notFound: {
    id: 'profile_shelves.not_found',
    defaultMessage: "We couldn't find that profile.",
  },
  save: { id: 'profile_shelves.save', defaultMessage: 'Save' },
  viewAs: {
    id: 'profile_shelves.view_as',
    defaultMessage: 'See it as others do',
  },
  aboutYou: {
    id: 'profile_shelves.about_you',
    defaultMessage: 'About you',
  },
});

interface Props {
  acct: string;
  // Your own profile, being edited (started from the Ж menu, owned by the
  // profile space so the block above edits too).
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  // Your own profile, as a circle of others sees it (See it as others do,
  // a button while designing): read through the viewer path with `as`,
  // never editable.
  viewAs?: ProfileAudience | null;
  onViewAs?: () => void;
}

export const ProfileFace: React.FC<Props> = ({
  acct,
  editing = false,
  onEditingChange,
  viewAs = null,
  onViewAs,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [cards, setCards] = useState<ApiProfileCardJSON[] | null>(null);
  const [pins, setPins] = useState<ApiPinnedKuestionJSON[] | null>(null);
  const [sections, setSections] = useState<ApiProfileSectionJSON[] | null>(
    null,
  );
  const [error, setError] = useState(false);

  // Seeing it as others do, the owner is a reader like anyone else.
  const isOwner = account !== null && account.id === me && !viewAs;

  useEffect(() => {
    let cancelled = false;
    setAccount(null);
    setCards(null);
    setPins(null);
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
        // Seeing your own as others do takes the viewer path too, as that
        // circle (`as`, which the server honours only for the owner).
        const viewingSelf = acctRes.id === me && !viewAs;
        const as = viewAs ?? undefined;
        const [cardsRes, pinsRes, sectionsRes] = await Promise.all([
          (viewingSelf
            ? apiGetOwnProfileCards()
            : apiGetProfileCards(acctRes.id, as)
          ).catch(() => [] as ApiProfileCardJSON[]),
          apiGetPinnedKuestions(acctRes.id, as).catch(
            () => [] as ApiPinnedKuestionJSON[],
          ),
          (viewingSelf
            ? apiGetOwnProfileSections()
            : apiGetProfileSections(acctRes.id, as)
          ).catch(() => [] as ApiProfileSectionJSON[]),
        ]);
        if (cancelled) return;
        setCards(cardsRes);
        setPins(pinsRes);
        setSections(sectionsRes);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct, dispatch, viewAs]);

  const handleCardsChange = useCallback((next: ApiProfileCardJSON[]) => {
    setCards(next);
  }, []);

  const handleSectionsChange = useCallback((next: ApiProfileSectionJSON[]) => {
    setSections(next);
  }, []);

  // Refetch the owner's pins, cards + sections. The Kuestions grid and
  // Section selector manage their own copies and don't push edits back up
  // here, so the View (which renders from this state) would otherwise show
  // stale data until a page reload.
  const refreshPins = useCallback(() => {
    if (!isOwner || !account) return;
    void apiGetPinnedKuestions(account.id)
      .then(setPins)
      .catch(() => undefined);
  }, [isOwner, account]);

  const refreshOwnContent = useCallback(() => {
    if (!isOwner) return;
    refreshPins();
    void Promise.all([
      apiGetOwnProfileCards().catch(() => [] as ApiProfileCardJSON[]),
      apiGetOwnProfileSections().catch(() => [] as ApiProfileSectionJSON[]),
    ]).then(([nextCards, nextSections]) => {
      setCards(nextCards);
      setSections(nextSections);
      return undefined;
    });
  }, [isOwner, refreshPins]);

  // Designing begun from "Say who you are" opens on the Kuestions.
  const [kuestionsFirst, setKuestionsFirst] = useState(false);
  const aboutYouRef = useRef<HTMLElement>(null);

  // Finishing an edit → pull fresh content so the edits show at once.
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current && !editing) {
      refreshOwnContent();
      setKuestionsFirst(false);
    }
    wasEditing.current = editing;
  }, [editing, refreshOwnContent]);

  const startEditing = useCallback(() => {
    setKuestionsFirst(false);
    onEditingChange?.(true);
  }, [onEditingChange]);
  const startOnKuestions = useCallback(() => {
    setKuestionsFirst(true);
    onEditingChange?.(true);
  }, [onEditingChange]);

  useEffect(() => {
    if (editing && kuestionsFirst) {
      aboutYouRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [editing, kuestionsFirst]);
  const stopEditing = useCallback(() => {
    onEditingChange?.(false);
  }, [onEditingChange]);

  if (error) {
    return (
      <div className='profile-shelves__empty'>
        {intl.formatMessage(messages.notFound)}
      </div>
    );
  }

  const loading =
    account === null || cards === null || pins === null || sections === null;
  // Cards keyed by an old field were moved to profile Kuestions and no
  // longer render, so they don't count as something shown.
  const nothingShown =
    !loading &&
    pins.length === 0 &&
    cards.every((c) => PROFILE_FIELD_BY_KEY[c.card_type]) &&
    sections.length === 0;

  return (
    <div className='profile-face'>
      {/* Owner toolbar, while designing only. Designing starts from the Ж
          menu (Design your profile) and ends with Save here. Each change
          has already saved as it was made (a field saves when focus leaves
          it, which pressing Save does), so Save is the way back to the
          view. Log out is not here: it is in the /me hub (Tal 2026-10-15).
          See it as others do is here too, not a moon: it is part of
          designing (Tal 2026-10-15). */}
      {account && isOwner && editing && (
        <div className='profile-shelves__edit-toolbar'>
          {onViewAs && (
            <KornerPill
              label={intl.formatMessage(messages.viewAs)}
              onClick={onViewAs}
            />
          )}
          <button
            type='button'
            className='profile-shelves__save'
            onClick={stopEditing}
          >
            {intl.formatMessage(messages.save)}
          </button>
        </div>
      )}

      {/* The bio and the counts are in the profile block above (Tal
          2026-10-15: the Joined · Posts · Mates bar here repeated the
          counts under the photo). What stays is the federated Mastodon
          fields, when there are any. */}
      {account && <ProfileMeta accountId={account.id} />}

      {loading ? (
        <div className='profile-shelves__loading'>
          {intl.formatMessage(messages.loading)}
        </div>
      ) : editing && isOwner && account ? (
        // Editing IS the profile. Same page, same tiles, same shelves, same
        // order — held to lift, dragged to move, with a + at the end. The
        // name, photo, cover and bio edit where they are; the profile
        // Kuestions you haven't answered sit under your answers.
        <div className='profile-shelves__arrange'>
          <ProfileBoard
            accountId={account.id}
            cards={cards ?? []}
            pins={pins ?? []}
            sections={[]}
            arrange
            onCardsChange={handleCardsChange}
            onPinsChange={setPins}
          />

          <section className='profile-face__about-you' ref={aboutYouRef}>
            <h3 className='profile-face__about-you-heading'>
              {intl.formatMessage(messages.aboutYou)}
            </h3>
            <ProfilePanel
              onChange={refreshPins}
              folded
              startOpen={kuestionsFirst}
            />
          </section>

          <ArrangeStack
            accountId={account.id}
            sections={sections ?? []}
            onChange={handleSectionsChange}
          />
        </div>
      ) : nothingShown && !isOwner ? (
        <div className='profile-shelves__empty'>
          {viewAs
            ? intl.formatMessage(messages.emptyViewAs)
            : intl.formatMessage(messages.emptyViewer)}
        </div>
      ) : account ? (
        <>
          {!nothingShown && (
            <ProfileBoard
              accountId={account.id}
              cards={cards ?? []}
              pins={pins ?? []}
              sections={sections ?? []}
              viewAs={viewAs ?? undefined}
            />
          )}
          {/* Your own, outside designing: + cards where things could go. */}
          {isOwner && (
            <ProfilePrompts
              sections={sections ?? []}
              hasKuestions={(pins ?? []).length > 0}
              empty={nothingShown}
              onSectionsChange={handleSectionsChange}
              onDesign={startEditing}
              onKuestions={startOnKuestions}
            />
          )}
        </>
      ) : null}
    </div>
  );
};
