import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiPinnedKuestionJSON } from 'mastodon/api_types/kuestions';

import {
  BirthdayValue,
  isLongText,
  linkHref,
  linkLabel,
  LocationValue,
  LongtextValue,
  toChips,
} from './profile_fields_display';

// The identity half of a profile — everything someone chose to say about
// themselves, in the space above their korners.
//
// It used to be one tile per field: a grey box with the field's name over its
// answer, repeated. That reads as a form, and most of the volume wasn't the
// answers — it was the labels. "Star sign: Scorpio" is twice the text of
// "Scorpio", and nobody needs telling which one Scorpio is. Dropping the
// label wherever the value speaks for itself halves the page before any
// design happens.
//
// So: four textures rather than one box, chosen by what the answer IS.
//
//   Stat line   short facts, inline and dot-separated. Six of them in the
//               room one box used to take, and it reads like someone
//               introducing themselves.
//   Chip field  lists, as bare words that wrap. No container, no heading —
//               "banjo" and "Cantonese" say what they are. Capped, with the
//               rest a tap away.
//   Prose       the only answers that are actually writing. Folded to a
//               couple of lines with `more`, which is the rule that stops a
//               wall: however many long answers someone writes, the page
//               only ever opens with a couple of lines of each.
//   Link row    domains, dot-separated.
//
// The reader gets everything short for free and only spends effort on the
// thing that's genuinely long. Someone who answered two questions gets a
// stat line, not a page of empty structure.
//
// What it lays out: pinned answers to Kronk's own profile Kuestions (they
// replaced profile Fields on 2026-10-12, and carry the old field keys as
// `seed_key`). The texture follows the answer's format. Answers to
// Kuestions members wrote are question-and-answer tiles below
// (ProfileKuestionTiles), since their question can't be dropped.

const messages = defineMessages({
  chipsMore: {
    id: 'profile_identity.chips_more',
    defaultMessage: '+{count}',
  },
});

// How many chips of one list show before the rest fold away. Enough to read
// as a cluster, few enough that a long list can't become the page.
const CHIPS_SHOWN = 6;

const ChipRow: React.FC<{ chips: string[]; label: string }> = ({
  chips,
  label,
}) => {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const expand = useCallback(() => {
    setExpanded(true);
  }, []);

  const shown = expanded ? chips : chips.slice(0, CHIPS_SHOWN);
  const hidden = chips.length - shown.length;

  return (
    <div className='profile-identity__chips' aria-label={label}>
      {shown.map((chip) => (
        <span className='profile-identity__chip' key={chip}>
          {chip}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type='button'
          className='profile-identity__chip profile-identity__chip--more'
          onClick={expand}
        >
          {intl.formatMessage(messages.chipsMore, { count: hidden })}
        </button>
      )}
    </div>
  );
};

interface ProfileIdentityProps {
  pins: ApiPinnedKuestionJSON[];
}

export const ProfileIdentity: React.FC<ProfileIdentityProps> = ({ pins }) => {
  const facts: React.ReactNode[] = [];
  const lists: React.ReactNode[] = [];
  const prose: React.ReactNode[] = [];
  const links: React.ReactNode[] = [];

  pins.forEach((pin) => {
    if (!pin.seed_key || pin.body.trim().length === 0) return;

    const text = pin.body;
    const label = pin.label ?? pin.title;
    const key = pin.question_id;

    // The field's name is dropped from view but kept for anyone reading with
    // a screen reader, where "Scorpio" on its own is genuinely ambiguous.
    const labelled = (node: React.ReactNode) => (
      <span
        className='profile-identity__fact'
        key={key}
        title={label}
        aria-label={`${label}: ${text}`}
      >
        {node}
      </span>
    );

    switch (pin.answer_format) {
      case 'longtext':
        prose.push(
          <div className='profile-identity__prose' key={key}>
            <LongtextValue text={text} />
          </div>,
        );
        return;

      case 'list':
        lists.push(<ChipRow key={key} chips={toChips(text)} label={label} />);
        return;

      case 'link':
        links.push(
          <a
            className='profile-identity__link'
            key={key}
            href={linkHref(text)}
            target='_blank'
            rel='noopener noreferrer'
          >
            {linkLabel(text)}
          </a>,
        );
        return;

      case 'date':
        facts.push(labelled(<BirthdayValue body={text} />));
        return;

      default:
        // A `text` answer long enough to break a line is prose wearing a
        // short answer's clothes — a listed-out personality, a sentence in
        // "Status". It reads with the paragraphs rather than in the run of
        // facts, where it would push everything after it onto a new line.
        if (isLongText(text)) {
          prose.push(
            <p className='profile-identity__prose' key={key}>
              {text}
            </p>,
          );
          return;
        }

        // Location keeps its map: tapping the place name opens a small map
        // centred on it. That affordance is worth more than the space it
        // costs, so it survives the flattening.
        facts.push(
          labelled(
            pin.seed_key === 'location' ? (
              <LocationValue text={text} />
            ) : (
              <span>{text}</span>
            ),
          ),
        );
    }
  });

  if (
    facts.length === 0 &&
    lists.length === 0 &&
    prose.length === 0 &&
    links.length === 0
  )
    return null;

  return (
    <div className='profile-identity'>
      {facts.length > 0 && (
        <div className='profile-identity__stats'>{facts}</div>
      )}
      {lists}
      {prose}
      {links.length > 0 && (
        <div className='profile-identity__links'>{links}</div>
      )}
    </div>
  );
};
