import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Redirect, useParams } from 'react-router-dom';

import { Helmet } from 'react-helmet';

import { apiRequestGet, apiRequestPut, apiRequestDelete } from 'mastodon/api';
import Column from 'mastodon/components/column';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';

// Profile Composer at /@:acct/edit. Owner-only — visitors get bounced
// back to /@:acct. Step 3 fills the left pane
// with the card palette; steps 4/5 wire the canvas + inspector.

const messages = defineMessages({
  title: { id: 'profile_compose.title', defaultMessage: 'Compose your profile' },
  crumbLead: { id: 'profile_compose.crumb.lead', defaultMessage: 'Profile' },
  crumbCurrent: { id: 'profile_compose.crumb.current', defaultMessage: 'Compose' },
  savedJustNow: { id: 'profile_compose.saved.just_now', defaultMessage: 'Saved just now' },
  preview: { id: 'profile_compose.preview_as_visitor', defaultMessage: 'Preview as visitor' },
  done: { id: 'profile_compose.done', defaultMessage: 'Done' },

  paletteHeading: { id: 'profile_compose.palette.heading', defaultMessage: 'Cards' },
  paletteSub: { id: 'profile_compose.palette.sub', defaultMessage: 'Click to add. Nothing appears on your profile until you put it there.' },
  paletteDisabled: { id: 'profile_compose.palette.disabled', defaultMessage: 'The composer is not yet enabled on this instance.' },

  groupWho: { id: 'profile_compose.group.who', defaultMessage: 'Who you are' },
  groupMake: { id: 'profile_compose.group.make', defaultMessage: 'What you make' },
  groupNow: { id: 'profile_compose.group.now', defaultMessage: 'Right now' },
  groupVerified: { id: 'profile_compose.group.verified', defaultMessage: 'Verified' },

  cardAbout: { id: 'profile_compose.card.about', defaultMessage: 'About me' },
  cardInterests: { id: 'profile_compose.card.interests', defaultMessage: 'Interests' },
  cardValues: { id: 'profile_compose.card.values', defaultMessage: 'Values' },
  cardPersonality: { id: 'profile_compose.card.personality', defaultMessage: 'Personality' },
  cardExploring: { id: 'profile_compose.card.exploring', defaultMessage: 'Currently exploring' },
  cardDrive: { id: 'profile_compose.card.drive', defaultMessage: 'What drives me' },
  cardNote: { id: 'profile_compose.card.note', defaultMessage: 'A note from you' },
  cardMoments: { id: 'profile_compose.card.moments', defaultMessage: 'Life in moments' },
  cardHighlights: { id: 'profile_compose.card.highlights', defaultMessage: 'Recent highlights' },
  cardAtAGlance: { id: 'profile_compose.card.at_a_glance', defaultMessage: 'At a glance' },
  cardRotation: { id: 'profile_compose.card.rotation', defaultMessage: 'In rotation' },
  cardOpenTo: { id: 'profile_compose.card.open_to', defaultMessage: 'Open to' },
  cardWhereIAm: { id: 'profile_compose.card.where_i_am', defaultMessage: 'Where I am' },
  cardPodCredentials: { id: 'profile_compose.card.pod_credentials', defaultMessage: 'Pod credentials' },

  canvasHeading: { id: 'profile_compose.canvas.heading', defaultMessage: 'Live canvas' },
  canvasEmpty: { id: 'profile_compose.canvas.empty', defaultMessage: 'Canvas lands in step 4.' },
  inspectorHeading: { id: 'profile_compose.inspector.heading', defaultMessage: 'Inspector' },
  inspectorEmpty: { id: 'profile_compose.inspector.empty', defaultMessage: 'Select a card to edit — inspector lands in step 5.' },
});

// A minimal shape mirroring REST::ProfileCardSerializer output.
// Broader ProfileCard type will move to api_types/profile_cards.ts when
// the canvas step needs it too.
interface ProfileCardJSON {
  id: string;
  card_type: string;
  body: string;
  visibility: 'everyone' | 'kronk' | 'connections' | 'vouched' | 'only_me';
  position: number;
  visible: boolean;
}

interface PaletteEntry {
  cardType: string;
  icon: string;
  label: { id: string; defaultMessage: string };
}

interface CardGroup {
  title: { id: string; defaultMessage: string };
  entries: PaletteEntry[];
}

// Bounded set matching ProfileCard::CARD_TYPES. Any addition here must
// be mirrored server-side; unknown card_types 422 on write.
const CARD_GROUPS: CardGroup[] = [
  {
    title: messages.groupWho,
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
    entries: [
      { cardType: 'moments', icon: '▦', label: messages.cardMoments },
      { cardType: 'highlights', icon: '◎', label: messages.cardHighlights },
      { cardType: 'at_a_glance', icon: '▤', label: messages.cardAtAGlance },
    ],
  },
  {
    title: messages.groupNow,
    entries: [
      { cardType: 'rotation', icon: '♪', label: messages.cardRotation },
      { cardType: 'open_to', icon: '◌', label: messages.cardOpenTo },
      { cardType: 'where_i_am', icon: '◍', label: messages.cardWhereIAm },
    ],
  },
  {
    title: messages.groupVerified,
    entries: [
      { cardType: 'pod_credentials', icon: '◈', label: messages.cardPodCredentials },
    ],
  },
];

interface AxiosLike {
  response?: { status?: number };
}

const isFeatureFlagOff = (e: unknown): boolean => {
  const err = e as AxiosLike;
  return err.response?.status === 404;
};

export const ProfileCompose = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct?: string }>();

  // Owner-only. Any viewer who lands on /@someone-else/edit falls back
  // to their read-only profile. The route also mounts under signedIn
  // guard in ui/index.jsx, so unsigned users never reach this branch.
  const myAccount = useAppSelector((state) =>
    me ? state.accounts.get(me) : undefined,
  );
  const myAcct = myAccount?.get('acct');

  const [cards, setCards] = useState<ProfileCardJSON[] | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<ProfileCardJSON[]>('v1/profile/cards')
      .then((rows) => {
        if (!cancelled) setCards(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isFeatureFlagOff(e)) {
          setCards([]);
          setFeatureAvailable(false);
        } else {
          setCards([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdd = useCallback((cardType: string) => {
    if (!featureAvailable) return;
    void apiRequestPut<ProfileCardJSON>(`v1/profile/cards/${cardType}`, {})
      .then((newCard) => {
        setCards((prev) => [...(prev ?? []), newCard]);
      })
      .catch((e) => {
        if (isFeatureFlagOff(e)) setFeatureAvailable(false);
      });
  }, [featureAvailable]);

  const handleRemove = useCallback((cardType: string) => {
    if (!featureAvailable) return;
    void apiRequestDelete(`v1/profile/cards/${cardType}`)
      .then(() => {
        setCards((prev) => prev?.filter((c) => c.card_type !== cardType) ?? []);
      })
      .catch((e) => {
        if (isFeatureFlagOff(e)) setFeatureAvailable(false);
      });
  }, [featureAvailable]);

  const usedTypes = new Set((cards ?? []).map((c) => c.card_type));

  // Owner gate. If the URL acct doesn't match the signed-in user's
  // acct, redirect to the read-only profile at /@:acct.
  if (acct && myAcct && acct !== myAcct) {
    return <Redirect to={`/@${acct}`} />;
  }

  const doneHref = myAcct ? `/@${myAcct}` : '/';

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <div className='scrollable kcompose'>
        <header className='kcompose__topbar'>
          <span className='kcompose__wordmark'>ӁЯѺƝ₭</span>
          <span className='kcompose__crumb'>
            <FormattedMessage {...messages.crumbLead} />
            {' · '}
            <b>
              <FormattedMessage {...messages.crumbCurrent} />
            </b>
          </span>

          <div className='kcompose__topbar-right'>
            <span className='kcompose__saved' aria-live='polite'>
              <FormattedMessage {...messages.savedJustNow} />
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

            {CARD_GROUPS.map((group) => (
              <div key={group.title.id}>
                <div className='kcompose__group'>{intl.formatMessage(group.title)}</div>
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
            ))}
          </aside>

          <main className='kcompose__pane kcompose__pane--center'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.canvasHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              <FormattedMessage {...messages.canvasEmpty} />
            </p>
          </main>

          <aside className='kcompose__pane kcompose__pane--right'>
            <p className='kcompose__pane-h'>
              <FormattedMessage {...messages.inspectorHeading} />
            </p>
            <p className='kcompose__pane-sub'>
              <FormattedMessage {...messages.inspectorEmpty} />
            </p>
          </aside>
        </div>
      </div>
    </Column>
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
      <span className='kcompose__pcard-label'>{intl.formatMessage(entry.label)}</span>
      <span className='kcompose__pcard-st' aria-hidden>
        {used ? '✓' : '＋'}
      </span>
    </button>
  );
};

export default ProfileCompose;
