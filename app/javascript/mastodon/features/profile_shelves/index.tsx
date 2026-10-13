/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { fetchRelationships } from 'mastodon/actions/accounts';
import { importFetchedAccount } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import { apiRequestGet } from 'mastodon/api';
import { apiGetPinnedKuestions } from 'mastodon/api/kuestions';
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
import type { ApiPinnedKuestionJSON } from 'mastodon/api_types/kuestions';
import { AccountBio } from 'mastodon/components/account_bio';
import { ProfilePanel } from 'mastodon/features/questions/profile_panel';
import { useKorner } from 'mastodon/hooks/useKorner';
import { me } from 'mastodon/initial_state';
import { useAppDispatch } from 'mastodon/store';

import { ArrangeStack } from './components/arrange_stack';
import { ProfileBioField } from './components/profile_bio_field';
import { ProfileBoard } from './components/profile_board';
import { ProfileMeta } from './components/profile_meta';
import { ProfileStatsStrip } from './components/profile_stats_strip';
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
  emptyOwner: {
    id: 'profile_shelves.empty_owner',
    defaultMessage: 'Nothing on the shelves yet.',
  },
  emptyOwnerCta: {
    id: 'profile_shelves.empty_owner_cta',
    defaultMessage: 'Edit your profile',
  },
  emptyViewer: {
    id: 'profile_shelves.empty_viewer',
    defaultMessage: 'This profile is quiet.',
  },
  notFound: {
    id: 'profile_shelves.not_found',
    defaultMessage: "We couldn't find that profile.",
  },
  save: { id: 'profile_shelves.save', defaultMessage: 'Save' },
  logOut: {
    id: 'profile_shelves.log_out',
    defaultMessage: 'Log out',
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
}

export const ProfileFace: React.FC<Props> = ({
  acct,
  editing = false,
  onEditingChange,
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

  const isOwner = account !== null && account.id === me;

  // Top korner drives the fourth stat on the "at a glance" strip.
  // Once the cutover backfill lands (docs/spaces/profile.md § open),
  // every existing account has ProfileSection rows for their top-3
  // korners — the first visible section is the top one. Until then
  // (and for anyone who's cleared their sections), the strip renders
  // three stats and this drops out.
  const topKornerSlug =
    typeof sections?.[0]?.settings.korner_slug === 'string'
      ? sections[0].settings.korner_slug
      : undefined;
  const topKorner = useKorner(topKornerSlug);
  const topKornerName = topKorner?.name;

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
        const viewingSelf = acctRes.id === me;
        const [cardsRes, pinsRes, sectionsRes] = await Promise.all([
          (viewingSelf
            ? apiGetOwnProfileCards()
            : apiGetProfileCards(acctRes.id)
          ).catch(() => [] as ApiProfileCardJSON[]),
          apiGetPinnedKuestions(acctRes.id).catch(
            () => [] as ApiPinnedKuestionJSON[],
          ),
          (viewingSelf
            ? apiGetOwnProfileSections()
            : apiGetProfileSections(acctRes.id)
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
  }, [acct, dispatch]);

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

  // Finishing an edit → pull fresh content so the edits show at once.
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current && !editing) refreshOwnContent();
    wasEditing.current = editing;
  }, [editing, refreshOwnContent]);

  const startEditing = useCallback(() => {
    onEditingChange?.(true);
  }, [onEditingChange]);
  const stopEditing = useCallback(() => {
    onEditingChange?.(false);
  }, [onEditingChange]);

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
      {/* Owner toolbar. Editing starts from the Ж menu (Edit profile) and
          ends with Save here, shown only while editing. Each change has
          already saved as it was made (a field saves when focus leaves it,
          which pressing Save does), so Save is the way back to the view. */}
      {account && isOwner && (
        <div className='profile-shelves__edit-toolbar'>
          {editing && (
            <button
              type='button'
              className='profile-shelves__save'
              onClick={stopEditing}
            >
              {intl.formatMessage(messages.save)}
            </button>
          )}
          <button
            type='button'
            className='profile-shelves__log-out'
            onClick={handleLogOut}
          >
            {intl.formatMessage(messages.logOut)}
          </button>
        </div>
      )}

      {/* The person, before their shelves: bio, an "at a glance" stats
          strip (Joined · Posts · Mates · Top korner) and — if they
          have any — their federated Mastodon fields.
          Viewer's own private note about this account moved to
          `/@:acct/settings` (2026-09-16); it wasn't part of THEIR
          profile, and inline placement made it look like it was. */}
      {account &&
        (editing && isOwner ? (
          <ProfileBioField />
        ) : (
          <AccountBio accountId={account.id} className='profile-face__bio' />
        ))}
      {account && (
        <ProfileStatsStrip
          accountId={account.id}
          topKornerName={topKornerName}
        />
      )}
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

          <section className='profile-face__about-you'>
            <h3 className='profile-face__about-you-heading'>
              {intl.formatMessage(messages.aboutYou)}
            </h3>
            <ProfilePanel onChange={refreshPins} />
          </section>

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
                onClick={startEditing}
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
          pins={pins ?? []}
          sections={sections ?? []}
        />
      ) : null}
    </div>
  );
};
