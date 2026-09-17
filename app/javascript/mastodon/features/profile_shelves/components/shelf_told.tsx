import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';

// Told shelf — owner-authored identity content. Dispatches on
// `card.render`:
//
//   block  — free-form paragraphs (default). Body renders as-is.
//   chips  — a tag list. Body is newline-or-comma separated.
//   rail   — a horizontal rail of mini-cards, each with
//            "Heading — Text" per line.
//
// New renders can ship in a pure-frontend PR — add a case here
// and a matching validator on the model.

const messages = defineMessages({
  cardAbout: {
    id: 'profile_shelves.card_type.about',
    defaultMessage: 'About',
  },
  cardInterests: {
    id: 'profile_shelves.card_type.interests',
    defaultMessage: 'Interests',
  },
  cardValues: {
    id: 'profile_shelves.card_type.values',
    defaultMessage: 'Values',
  },
  cardExploring: {
    id: 'profile_shelves.card_type.exploring',
    defaultMessage: 'Currently exploring',
  },
  cardPersonality: {
    id: 'profile_shelves.card_type.personality',
    defaultMessage: 'Personality',
  },
  cardDrive: {
    id: 'profile_shelves.card_type.drive',
    defaultMessage: 'What drives me',
  },
  cardRotation: {
    id: 'profile_shelves.card_type.rotation',
    defaultMessage: 'In rotation',
  },
  cardMoments: {
    id: 'profile_shelves.card_type.moments',
    defaultMessage: 'Moments',
  },
  cardNote: {
    id: 'profile_shelves.card_type.note',
    defaultMessage: 'Note',
  },
  cardHighlights: {
    id: 'profile_shelves.card_type.highlights',
    defaultMessage: 'Highlights',
  },
  cardAtAGlance: {
    id: 'profile_shelves.card_type.at_a_glance',
    defaultMessage: 'At a glance',
  },
  cardOpenTo: {
    id: 'profile_shelves.card_type.open_to',
    defaultMessage: 'Open to',
  },
  cardWhereIAm: {
    id: 'profile_shelves.card_type.where_i_am',
    defaultMessage: 'Where I am',
  },
  cardPodCredentials: {
    id: 'profile_shelves.card_type.pod_credentials',
    defaultMessage: 'Pod credentials',
  },
});

const TITLE_FOR: Record<string, keyof typeof messages> = {
  about: 'cardAbout',
  interests: 'cardInterests',
  values: 'cardValues',
  exploring: 'cardExploring',
  personality: 'cardPersonality',
  drive: 'cardDrive',
  rotation: 'cardRotation',
  moments: 'cardMoments',
  note: 'cardNote',
  highlights: 'cardHighlights',
  at_a_glance: 'cardAtAGlance',
  open_to: 'cardOpenTo',
  where_i_am: 'cardWhereIAm',
  pod_credentials: 'cardPodCredentials',
};

// Split rail body into { heading, text } pairs. Each line is either
// `Heading — Text` (em dash), `Heading - Text` (ascii dash), or
// `Heading: Text`. Anything else is a heading-only entry.
const parseRail = (body: string) =>
  body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(.+?)\s*[—:-]\s+(.+)$/.exec(line);
      return match?.[1] && match[2]
        ? { heading: match[1], text: match[2] }
        : { heading: line, text: '' };
    });

// Split chips body on comma or newline; trim whitespace; drop empties.
const parseChips = (body: string) =>
  body
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

interface ShelfTitleProps {
  cardType: string;
}

const ShelfTitle: React.FC<ShelfTitleProps> = ({ cardType }) => {
  const intl = useIntl();
  const messageKey = TITLE_FOR[cardType];
  const title = messageKey
    ? intl.formatMessage(messages[messageKey])
    : cardType.replaceAll('_', ' ');
  return <h3 className='profile-shelves__shelf-title'>{title}</h3>;
};

interface ShelfToldProps {
  card: ApiProfileCardJSON;
}

export const ShelfTold: React.FC<ShelfToldProps> = ({ card }) => (
  <section className='profile-shelves__shelf profile-shelves__shelf--told'>
    <header className='profile-shelves__shelf-head'>
      <ShelfTitle cardType={card.card_type} />
    </header>
    {card.render === 'chips' ? (
      <div className='profile-shelves__told-chips'>
        {parseChips(card.body).map((chip) => (
          <span key={chip} className='profile-shelves__chip'>
            {chip}
          </span>
        ))}
      </div>
    ) : card.render === 'rail' ? (
      <ul className='profile-shelves__told-rail'>
        {parseRail(card.body).map((entry, i) => (
          <li
            key={`${entry.heading}-${i}`}
            className='profile-shelves__told-rail-item'
          >
            <div className='profile-shelves__told-rail-heading'>
              {entry.heading}
            </div>
            {entry.text && (
              <div className='profile-shelves__told-rail-text'>
                {entry.text}
              </div>
            )}
          </li>
        ))}
      </ul>
    ) : (
      // block (default) — server returns sanitised HTML like Account.note.
      <div
        className='profile-shelves__told-block'
        dangerouslySetInnerHTML={{ __html: card.body }}
      />
    )}
  </section>
);
