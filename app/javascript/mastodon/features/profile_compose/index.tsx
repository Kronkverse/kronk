import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, useParams } from 'react-router-dom';

import { apiRequestGet, apiRequestPut, apiRequestDelete } from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Profile Composer at /@:acct/edit. Owner-only — visitors get bounced
// back to /@:acct. Left pane: card palette (step 3). Centre: the live
// canvas of placed cards, each with an inline visibility dial (step 4).
// Right: the inspector for the selected card — body + visibility (step 5).

const messages = defineMessages({
  title: {
    id: 'profile_compose.title',
    defaultMessage: 'Compose your profile',
  },
  crumbLead: { id: 'profile_compose.crumb.lead', defaultMessage: 'Profile' },
  crumbCurrent: {
    id: 'profile_compose.crumb.current',
    defaultMessage: 'Compose',
  },
  saving: { id: 'profile_compose.saving', defaultMessage: 'Saving…' },
  saved: { id: 'profile_compose.saved', defaultMessage: 'Saved' },
  saveError: {
    id: 'profile_compose.save_error',
    defaultMessage: 'Couldn’t save',
  },
  preview: {
    id: 'profile_compose.preview_as_visitor',
    defaultMessage: 'Preview as visitor',
  },
  done: { id: 'profile_compose.done', defaultMessage: 'Done' },

  modeMe: { id: 'profile_compose.mode.me', defaultMessage: 'Me' },
  modeWork: { id: 'profile_compose.mode.work', defaultMessage: 'My Work' },
  modeHeader: { id: 'profile_compose.mode.header', defaultMessage: 'Header' },
  headerStub: {
    id: 'profile_compose.header_stub',
    defaultMessage:
      'Cover image, avatar and display name — editing lands in the next step.',
  },

  paletteHeading: {
    id: 'profile_compose.palette.heading',
    defaultMessage: 'Cards',
  },
  paletteSub: {
    id: 'profile_compose.palette.sub',
    defaultMessage:
      'Click to add. Nothing appears on your profile until you put it there.',
  },
  paletteDisabled: {
    id: 'profile_compose.palette.disabled',
    defaultMessage: 'The composer is not yet enabled on this instance.',
  },

  groupWho: { id: 'profile_compose.group.who', defaultMessage: 'Who you are' },
  groupMake: {
    id: 'profile_compose.group.make',
    defaultMessage: 'What you make',
  },
  groupNow: { id: 'profile_compose.group.now', defaultMessage: 'Right now' },
  groupVerified: {
    id: 'profile_compose.group.verified',
    defaultMessage: 'Verified',
  },

  cardAbout: { id: 'profile_compose.card.about', defaultMessage: 'About me' },
  cardInterests: {
    id: 'profile_compose.card.interests',
    defaultMessage: 'Interests',
  },
  cardValues: { id: 'profile_compose.card.values', defaultMessage: 'Values' },
  cardPersonality: {
    id: 'profile_compose.card.personality',
    defaultMessage: 'Personality',
  },
  cardExploring: {
    id: 'profile_compose.card.exploring',
    defaultMessage: 'Currently exploring',
  },
  cardDrive: {
    id: 'profile_compose.card.drive',
    defaultMessage: 'What drives me',
  },
  cardNote: {
    id: 'profile_compose.card.note',
    defaultMessage: 'A note from you',
  },
  cardMoments: {
    id: 'profile_compose.card.moments',
    defaultMessage: 'Life in moments',
  },
  cardHighlights: {
    id: 'profile_compose.card.highlights',
    defaultMessage: 'Recent highlights',
  },
  cardAtAGlance: {
    id: 'profile_compose.card.at_a_glance',
    defaultMessage: 'At a glance',
  },
  cardRotation: {
    id: 'profile_compose.card.rotation',
    defaultMessage: 'In rotation',
  },
  cardOpenTo: { id: 'profile_compose.card.open_to', defaultMessage: 'Open to' },
  cardWhereIAm: {
    id: 'profile_compose.card.where_i_am',
    defaultMessage: 'Where I am',
  },
  cardPodCredentials: {
    id: 'profile_compose.card.pod_credentials',
    defaultMessage: 'Pod credentials',
  },

  canvasHeading: {
    id: 'profile_compose.canvas.heading',
    defaultMessage: 'Live canvas',
  },
  canvasEmpty: {
    id: 'profile_compose.canvas.empty',
    defaultMessage:
      'Add cards from the palette. They land here, hidden, until you choose who can see them.',
  },
  bodyPlaceholder: {
    id: 'profile_compose.body_placeholder',
    defaultMessage: 'Nothing here yet — click to write.',
  },

  inspectorHeading: {
    id: 'profile_compose.inspector.heading',
    defaultMessage: 'Inspector',
  },
  inspectorEmpty: {
    id: 'profile_compose.inspector.empty',
    defaultMessage: 'Select a card on the canvas to edit it.',
  },
  inspectorBody: {
    id: 'profile_compose.inspector.body',
    defaultMessage: 'Text',
  },
  inspectorWhoCanSee: {
    id: 'profile_compose.inspector.who_can_see',
    defaultMessage: 'Who can see this',
  },
  inspectorWhoHint: {
    id: 'profile_compose.inspector.who_hint',
    defaultMessage: 'This card only. Takes effect immediately.',
  },
  inspectorRemove: {
    id: 'profile_compose.inspector.remove',
    defaultMessage: 'Remove this card from your profile',
  },

  visSelf: {
    id: 'profile_compose.visibility.self_only',
    defaultMessage: 'Me',
  },
  visMates: {
    id: 'profile_compose.visibility.mates',
    defaultMessage: 'Mates',
  },
  visOrbit: {
    id: 'profile_compose.visibility.orbit',
    defaultMessage: 'Orbit',
  },
  visPublic: {
    id: 'profile_compose.visibility.public',
    defaultMessage: 'Kronkverse',
  },
});

interface ProfileCardJSON {
  id: string;
  card_type: string;
  body: string;
  visibility: 'self_only' | 'mates' | 'orbit' | 'public';
  position: number;
  visible: boolean;
}

type Visibility = ProfileCardJSON['visibility'];

// Narrow → wide, matching the reach ladder used everywhere.
const VISIBILITY_ORDER: Visibility[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
];

const VISIBILITY_LABELS: Record<
  Visibility,
  { id: string; defaultMessage: string }
> = {
  self_only: messages.visSelf,
  mates: messages.visMates,
  orbit: messages.visOrbit,
  public: messages.visPublic,
};

interface PaletteEntry {
  cardType: string;
  icon: string;
  label: { id: string; defaultMessage: string };
}

type Mode = 'me' | 'work' | 'header';

interface CardGroup {
  title: { id: string; defaultMessage: string };
  mode: Exclude<Mode, 'header'>;
  entries: PaletteEntry[];
}

// Bounded set matching ProfileCard::CARD_TYPES. Any addition here must
// be mirrored server-side; unknown card_types 422 on write. `mode` sorts
// each group into the composer's Me / My Work tabs.
const CARD_GROUPS: CardGroup[] = [
  {
    title: messages.groupWho,
    mode: 'me',
    entries: [
      { cardType: 'about', icon: '◔', label: messages.cardAbout },
      { cardType: 'interests', icon: '❋', label: messages.cardInterests },
      { cardType: 'values', icon: '◈', label: messages.cardValues },
      { cardType: 'personality', icon: '✦', label: messages.cardPersonality },
      { cardType: 'exploring', icon: '◇', label: messages.cardExploring },
      { cardType: 'drive', icon: '“', label: messages.cardDrive },
      { cardType: 'note', icon: '✎', label: messages.cardNote },
    ],
  },
  {
    title: messages.groupMake,
    mode: 'work',
    entries: [
      { cardType: 'moments', icon: '▦', label: messages.cardMoments },
      { cardType: 'highlights', icon: '◎', label: messages.cardHighlights },
      { cardType: 'at_a_glance', icon: '▤', label: messages.cardAtAGlance },
    ],
  },
  {
    title: messages.groupNow,
    mode: 'me',
    entries: [
      { cardType: 'rotation', icon: '♪', label: messages.cardRotation },
      { cardType: 'open_to', icon: '◌', label: messages.cardOpenTo },
      { cardType: 'where_i_am', icon: '◍', label: messages.cardWhereIAm },
    ],
  },
  {
    title: messages.groupVerified,
    mode: 'me',
    entries: [
      {
        cardType: 'pod_credentials',
        icon: '◈',
        label: messages.cardPodCredentials,
      },
    ],
  },
];

const CARD_META: Record<string, PaletteEntry> = Object.fromEntries(
  CARD_GROUPS.flatMap((group) =>
    group.entries.map((entry) => [entry.cardType, entry] as const),
  ),
) as Record<string, PaletteEntry>;

// card_type -> the mode it belongs to, for filtering the canvas.
const CARD_MODE: Record<string, Mode> = Object.fromEntries(
  CARD_GROUPS.flatMap((group) =>
    group.entries.map((entry) => [entry.cardType, group.mode] as const),
  ),
) as Record<string, Mode>;

const MODE_TABS: {
  key: Mode;
  label: { id: string; defaultMessage: string };
}[] = [
  { key: 'me', label: messages.modeMe },
  { key: 'work', label: messages.modeWork },
  { key: 'header', label: messages.modeHeader },
];

interface AxiosLike {
  response?: { status?: number };
}

const isFeatureFlagOff = (e: unknown): boolean => {
  const err = e as AxiosLike;
  return err.response?.status === 404;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const ProfileCompose = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct?: string }>();

  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const myAcct = myAccount?.get('acct');

  const [cards, setCards] = useState<ProfileCardJSON[] | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [mode, setMode] = useState<Mode>('me');
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The composer only ever edits the signed-in account's own cards
    // (`v1/profile/cards` is self-scoped). Don't load anything when the URL
    // names someone else — or before we know who we are — so we never fetch
    // or render editor data on another account's edit URL.
    if (acct && acct !== myAcct) return undefined;

    let cancelled = false;
    void apiRequestGet<ProfileCardJSON[]>('v1/profile/cards')
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setCards([]);
        if (isFeatureFlagOff(e)) setFeatureAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [acct, myAcct]);

  useEffect(
    () => () => {
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
    },
    [],
  );

  const saveCard = useCallback(
    (
      cardType: string,
      patch: Partial<Pick<ProfileCardJSON, 'body' | 'visibility'>>,
    ) => {
      setSaveStatus('saving');
      return apiRequestPut<ProfileCardJSON>(
        `v1/profile/cards/${cardType}`,
        patch,
      )
        .then((updated) => {
          setCards((prev) =>
            (prev ?? []).map((c) => (c.card_type === cardType ? updated : c)),
          );
          setSaveStatus('saved');
        })
        .catch((e: unknown) => {
          if (isFeatureFlagOff(e)) setFeatureAvailable(false);
          setSaveStatus('error');
        });
    },
    [],
  );

  const handleAdd = useCallback(
    (cardType: string) => {
      if (!featureAvailable) return;
      void apiRequestPut<ProfileCardJSON>(`v1/profile/cards/${cardType}`, {})
        .then((newCard) => {
          setCards((prev) => [...(prev ?? []), newCard]);
          setSelectedType(cardType);
        })
        .catch((e: unknown) => {
          if (isFeatureFlagOff(e)) setFeatureAvailable(false);
        });
    },
    [featureAvailable],
  );

  const handleRemove = useCallback((cardType: string) => {
    void apiRequestDelete(`v1/profile/cards/${cardType}`)
      .then(() => {
        setCards((prev) => prev?.filter((c) => c.card_type !== cardType) ?? []);
        setSelectedType((sel) => (sel === cardType ? null : sel));
      })
      .catch((e: unknown) => {
        if (isFeatureFlagOff(e)) setFeatureAvailable(false);
      });
  }, []);

  const handleBodyChange = useCallback(
    (cardType: string, body: string) => {
      setCards((prev) =>
        (prev ?? []).map((c) =>
          c.card_type === cardType ? { ...c, body } : c,
        ),
      );
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
      bodyTimer.current = setTimeout(() => {
        void saveCard(cardType, { body });
      }, 500);
    },
    [saveCard],
  );

  const handleVisibility = useCallback(
    (cardType: string, visibility: Visibility) => {
      setCards((prev) =>
        (prev ?? []).map((c) =>
          c.card_type === cardType ? { ...c, visibility } : c,
        ),
      );
      void saveCard(cardType, { visibility });
    },
    [saveCard],
  );

  const usedTypes = new Set((cards ?? []).map((c) => c.card_type));
  const placed = (cards ?? []).slice().sort((a, b) => a.position - b.position);
  const selectedCard = placed.find((c) => c.card_type === selectedType) ?? null;
  const visibleGroups = CARD_GROUPS.filter((group) => group.mode === mode);
  const modeCards = placed.filter(
    (card) => (CARD_MODE[card.card_type] ?? 'me') === mode,
  );

  // Owner gate. The composer edits the signed-in account only, so an edit URL
  // that names someone else must never render the editor. If we know who we
  // are and it isn't us, bounce to that account's (read-only) profile; while
  // ownership is still unknown (accounts not yet hydrated), render nothing
  // rather than flash the editor chrome on someone else's URL.
  if (acct && acct !== myAcct) {
    return myAcct ? <Redirect to={`/@${acct}`} /> : null;
  }

  const doneHref = myAcct ? `/@${myAcct}` : '/';

  const statusLabel =
    saveStatus === 'saving'
      ? intl.formatMessage(messages.saving)
      : saveStatus === 'error'
        ? intl.formatMessage(messages.saveError)
        : saveStatus === 'saved'
          ? intl.formatMessage(messages.saved)
          : '';

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='scrollable kcompose'>
        <header className='kcompose__topbar'>
          <span className='kcompose__wordmark'>ЖЯѺƝ₭</span>
          <span className='kcompose__crumb'>
            <FormattedMessage {...messages.crumbLead} />
            {' · '}
            <b>
              <FormattedMessage {...messages.crumbCurrent} />
            </b>
          </span>

          <div className='kcompose__topbar-right'>
            <span
              className={`kcompose__saved kcompose__saved--${saveStatus}`}
              aria-live='polite'
            >
              {statusLabel}
            </span>
            <button type='button' className='kcompose__btn' disabled>
              <FormattedMessage {...messages.preview} />
            </button>
            <a href={doneHref} className='kcompose__btn kcompose__btn--primary'>
              <FormattedMessage {...messages.done} />
            </a>
          </div>
        </header>

        <div className='kcompose__panes'>
          <aside className='kcompose__pane kcompose__pane--left'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.paletteHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              {featureAvailable ? (
                <FormattedMessage {...messages.paletteSub} />
              ) : (
                <FormattedMessage {...messages.paletteDisabled} />
              )}
            </p>

            {mode === 'header' ? (
              <p className='kcompose__pane-sub'>
                <FormattedMessage {...messages.headerStub} />
              </p>
            ) : (
              visibleGroups.map((group) => (
                <div key={group.title.id}>
                  <div className='kcompose__group'>
                    {intl.formatMessage(group.title)}
                  </div>
                  {group.entries.map((entry) => (
                    <PaletteCard
                      key={entry.cardType}
                      entry={entry}
                      used={usedTypes.has(entry.cardType)}
                      disabled={!featureAvailable}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              ))
            )}
          </aside>

          <main className='kcompose__pane kcompose__pane--center'>
            <nav className='kcompose__modes'>
              {MODE_TABS.map((tab) => (
                <ModeTab
                  key={tab.key}
                  tab={tab}
                  active={mode === tab.key}
                  onSelect={setMode}
                />
              ))}
            </nav>
            {mode === 'header' ? (
              <p className='kcompose__pane-sub'>
                <FormattedMessage {...messages.headerStub} />
              </p>
            ) : modeCards.length === 0 ? (
              <p className='kcompose__pane-sub'>
                <FormattedMessage {...messages.canvasEmpty} />
              </p>
            ) : (
              <div className='kcompose__canvas'>
                {modeCards.map((card) => (
                  <CanvasCard
                    key={card.card_type}
                    card={card}
                    selected={card.card_type === selectedType}
                    onSelect={setSelectedType}
                    onCycleVisibility={handleVisibility}
                  />
                ))}
              </div>
            )}
          </main>

          <aside className='kcompose__pane kcompose__pane--right'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.inspectorHeading} />
            </p>
            {selectedCard ? (
              <Inspector
                card={selectedCard}
                onBodyChange={handleBodyChange}
                onVisibility={handleVisibility}
                onRemove={handleRemove}
              />
            ) : (
              <p className='kcompose__pane-sub'>
                <FormattedMessage {...messages.inspectorEmpty} />
              </p>
            )}
          </aside>
        </div>
      </div>
    </Column>
  );
};

const ModeTab: React.FC<{
  tab: { key: Mode; label: { id: string; defaultMessage: string } };
  active: boolean;
  onSelect: (mode: Mode) => void;
}> = ({ tab, active, onSelect }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onSelect(tab.key);
  }, [onSelect, tab.key]);

  return (
    <button
      type='button'
      className={`kcompose__mode${active ? ' kcompose__mode--on' : ''}`}
      onClick={handleClick}
      aria-pressed={active}
    >
      {intl.formatMessage(tab.label)}
    </button>
  );
};

const PaletteCard: React.FC<{
  entry: PaletteEntry;
  used: boolean;
  disabled: boolean;
  onAdd: (cardType: string) => void;
  onRemove: (cardType: string) => void;
}> = ({ entry, used, disabled, onAdd, onRemove }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    if (disabled) return;
    if (used) onRemove(entry.cardType);
    else onAdd(entry.cardType);
  }, [disabled, used, entry.cardType, onAdd, onRemove]);

  return (
    <button
      type='button'
      className={`kcompose__pcard${used ? ' kcompose__pcard--used' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={used}
    >
      <span className='kcompose__pcard-ic' aria-hidden>
        {entry.icon}
      </span>
      <span className='kcompose__pcard-label'>
        {intl.formatMessage(entry.label)}
      </span>
      <span className='kcompose__pcard-st' aria-hidden>
        {used ? '✓' : '＋'}
      </span>
    </button>
  );
};

const CanvasCard: React.FC<{
  card: ProfileCardJSON;
  selected: boolean;
  onSelect: (cardType: string) => void;
  onCycleVisibility: (cardType: string, visibility: Visibility) => void;
}> = ({ card, selected, onSelect, onCycleVisibility }) => {
  const intl = useIntl();
  const meta = CARD_META[card.card_type];

  const handleSelect = useCallback(() => {
    onSelect(card.card_type);
  }, [onSelect, card.card_type]);

  const handleCycle = useCallback(() => {
    const idx = VISIBILITY_ORDER.indexOf(card.visibility);
    const next =
      VISIBILITY_ORDER[(idx + 1) % VISIBILITY_ORDER.length] ?? 'public';
    onCycleVisibility(card.card_type, next);
  }, [card.card_type, card.visibility, onCycleVisibility]);

  const handleVisClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleCycle();
    },
    [handleCycle],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    },
    [handleSelect],
  );

  return (
    <div
      className={`kcompose__ccard${selected ? ' kcompose__ccard--sel' : ''} kcompose__ccard--${card.visibility}`}
      onClick={handleSelect}
      role='button'
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={handleKeyDown}
    >
      <button
        type='button'
        className='kcompose__vis'
        onClick={handleVisClick}
        title={intl.formatMessage(messages.inspectorWhoCanSee)}
      >
        <span className='kcompose__vis-ring' aria-hidden />
        {intl.formatMessage(VISIBILITY_LABELS[card.visibility])}
      </button>
      <h4 className='kcompose__ccard-title'>
        {meta ? intl.formatMessage(meta.label) : card.card_type}
      </h4>
      <p
        className={`kcompose__ccard-body${card.body ? '' : ' kcompose__ccard-body--empty'}`}
      >
        {card.body || intl.formatMessage(messages.bodyPlaceholder)}
      </p>
    </div>
  );
};

const Inspector: React.FC<{
  card: ProfileCardJSON;
  onBodyChange: (cardType: string, body: string) => void;
  onVisibility: (cardType: string, visibility: Visibility) => void;
  onRemove: (cardType: string) => void;
}> = ({ card, onBodyChange, onVisibility, onRemove }) => {
  const intl = useIntl();
  const cardType = card.card_type;
  const meta = CARD_META[cardType];

  const handleBody = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onBodyChange(cardType, e.target.value);
    },
    [onBodyChange, cardType],
  );

  const handleVisSelect = useCallback(
    (visibility: ReachValue) => {
      // Krew is hidden, so the value is always one of the profile ladder rungs.
      onVisibility(cardType, visibility as Visibility);
    },
    [onVisibility, cardType],
  );

  const handleRemoveClick = useCallback(() => {
    onRemove(cardType);
  }, [onRemove, cardType]);

  return (
    <div className='kcompose__insp'>
      <h3 className='kcompose__insp-title'>
        {meta ? intl.formatMessage(meta.label) : cardType}
      </h3>

      <label className='kcompose__insp-label' htmlFor='kcompose-body'>
        <FormattedMessage {...messages.inspectorBody} />
      </label>
      <textarea
        id='kcompose-body'
        className='kcompose__insp-textarea'
        rows={5}
        value={card.body}
        onChange={handleBody}
      />

      <div className='kcompose__vis-block'>
        <div className='kcompose__insp-label'>
          <FormattedMessage {...messages.inspectorWhoCanSee} />
        </div>
        <p className='kcompose__insp-hint'>
          <FormattedMessage {...messages.inspectorWhoHint} />
        </p>
        <ReachDropdown
          value={card.visibility}
          onChange={handleVisSelect}
        />
      </div>

      <div className='kcompose__danger'>
        <button type='button' onClick={handleRemoveClick}>
          <FormattedMessage {...messages.inspectorRemove} />
        </button>
      </div>
    </div>
  );
};
