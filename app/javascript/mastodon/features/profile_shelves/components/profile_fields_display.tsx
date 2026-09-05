import { useState, useCallback, lazy, Suspense } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import CelebrationIcon from '@/material-icons/400-24px/celebration.svg?react';
import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import LocationOnIcon from '@/material-icons/400-24px/location_on.svg?react';
import { apiGeocodeSearch } from 'mastodon/api/map';
import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import { Icon } from 'mastodon/components/icon';
import { unescapeHTML } from 'mastodon/utils/html';

import type {
  FieldAnswerType,
  ProfileFieldDef,
} from '../profile_field_catalog';

// Read-side render of the structured profile fields. Calm + typed: each field
// renders as the thing it means rather than a wall of identical boxes —
// chips become pills, links become a link chip, long answers clamp until
// asked to open, everything else is quiet inline text. Borderless on a plain
// ground so the values (not their frames) carry the visual weight. Only
// filled fields show. Non-field told cards + drawn korner sections still
// render as their own tiles on the board.

const messages = defineMessages({
  heading: {
    id: 'profile_shelves.fields.heading',
    defaultMessage: 'Profile fields',
  },
  more: { id: 'profile_shelves.fields.more', defaultMessage: 'Show more' },
  less: { id: 'profile_shelves.fields.less', defaultMessage: 'Show less' },
  bdayToday: {
    id: 'profile_shelves.fields.birthday_today',
    defaultMessage: 'Birthday today',
  },
  bdayTomorrow: {
    id: 'profile_shelves.fields.birthday_tomorrow',
    defaultMessage: 'Tomorrow',
  },
  bdayInDays: {
    id: 'profile_shelves.fields.birthday_in_days',
    defaultMessage: 'in {days, plural, one {# day} other {# days}}',
  },
});

interface BirthDate {
  year: number;
  month: number;
  day: number;
}

const parseISODate = (value: string): BirthDate | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: Number(m[1]), month, day };
};

// Whole days from today until this year's (or next year's) recurrence of the
// month/day. 0 = today.
const daysUntilAnniversary = (month: number, day: number): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month - 1, day);
  if (next.getTime() < today.getTime())
    next = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
};

const BirthdayValue: React.FC<{ body: string }> = ({ body }) => {
  const intl = useIntl();
  const text = unescapeHTML(body);
  const parsed = parseISODate(text);

  // Legacy free-text birthdays (unparseable) just show as-is.
  if (!parsed) {
    return <span className='profile-fields-display__text'>{text}</span>;
  }

  const days = daysUntilAnniversary(parsed.month, parsed.day);
  const dateLabel = intl.formatDate(
    new Date(2000, parsed.month - 1, parsed.day),
    {
      month: 'short',
      day: 'numeric',
    },
  );
  const countdown =
    days === 0
      ? intl.formatMessage(messages.bdayToday)
      : days === 1
        ? intl.formatMessage(messages.bdayTomorrow)
        : intl.formatMessage(messages.bdayInDays, { days });

  return (
    <span
      className={classNames('profile-fields-display__birthday', {
        'profile-fields-display__birthday--soon': days <= 7,
      })}
    >
      <Icon
        id=''
        icon={CelebrationIcon}
        className='profile-fields-display__birthday-icon'
      />
      <span className='profile-fields-display__birthday-date'>{dateLabel}</span>
      <span className='profile-fields-display__birthday-sep' aria-hidden='true'>
        ·
      </span>
      <span className='profile-fields-display__birthday-countdown'>
        {countdown}
      </span>
    </span>
  );
};

// chips: split the plain-text body into tags.
//
// Commas and newlines alone weren't enough. People separate lists the way they
// read them, and a middot or a bullet is just as natural as a comma — so
// "Film photography · Leatherwork · Governance" arrived as a single pill
// while "field recordings, Arthur Russell" split into two. Same field type,
// two different results, decided by punctuation (Tal's profile, 2026-09-05).
//
// Semicolons and vertical bars are here for the same reason. Slashes are
// deliberately NOT separators: `pair` answers use them ("she / her"), and a
// chips value like "and/or" would shatter.
const CHIP_SEPARATORS = /[,;|\n\u00b7\u2022]/;

export const toChips = (text: string): string[] =>
  text
    .split(CHIP_SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

// A `text` answer long enough that a narrow column would mangle it. The
// threshold is a judgement, not a measurement: "Sydney" and "she / her" stay
// in a column, a listed-out personality or a sentence does not.
const LONG_TEXT_THRESHOLD = 32;

export const isLongText = (body: string): boolean =>
  body.trim().length > LONG_TEXT_THRESHOLD;

const linkHref = (raw: string): string =>
  /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

// Strip protocol / www / trailing slash so the chip shows a clean domain.
const linkLabel = (raw: string): string =>
  raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');

// Long answers clamp until asked to expand; short ones never show a toggle.
const CLAMP_AT = 220;

const LongtextValue: React.FC<{ html: string }> = ({ html }) => {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => {
    setExpanded((value) => !value);
  }, []);
  const overflows = unescapeHTML(html).length > CLAMP_AT;

  return (
    <div className='profile-fields-display__long'>
      <div
        className={classNames('profile-fields-display__longbody', {
          'profile-fields-display__longbody--clamped': overflows && !expanded,
        })}
        // Sanitised HTML from the serializer — same as ShelfTold's block.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflows && (
        <button
          type='button'
          className='profile-fields-display__more'
          onClick={toggle}
        >
          {intl.formatMessage(expanded ? messages.less : messages.more)}
        </button>
      )}
    </div>
  );
};

// The map preview pulls in MapLibre, so load it only when a viewer actually
// opens a location — it stays out of the profile bundle until then.
const MapPinPreviewLazy = lazy(() =>
  import('mastodon/components/map_pin_preview').then((m) => ({
    default: m.MapPinPreview,
  })),
);

// Location field — the place text is a quiet pin chip; tapping it geocodes
// the name and reveals a small map centred there. "Just a connection to
// maps": no stored coordinate, no picker — the text you typed drives it.
const LocationValue: React.FC<{ text: string }> = ({ text }) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    if (coords) {
      setOpen(true);
      return;
    }
    setLoading(true);
    void apiGeocodeSearch(text)
      .then((results) => {
        const first = results[0];
        if (first) {
          setCoords({ lat: first.lat, lng: first.lng });
          setOpen(true);
        } else {
          setFailed(true);
        }
        setLoading(false);
        return undefined;
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, [open, coords, text]);

  // Nothing to map (geocode found no place) — just show the text.
  if (failed) {
    return <span className='profile-fields-display__text'>{text}</span>;
  }

  return (
    <div className='profile-fields-display__location'>
      <button
        type='button'
        className='profile-fields-display__location-chip'
        onClick={toggle}
        disabled={loading}
        aria-expanded={open}
      >
        <Icon
          id=''
          icon={LocationOnIcon}
          className='profile-fields-display__location-icon'
        />
        <span>{text}</span>
      </button>
      {open && coords && (
        <Suspense
          fallback={
            <div className='profile-fields-display__location-map profile-fields-display__location-map--loading' />
          }
        >
          <MapPinPreviewLazy
            lat={coords.lat}
            lng={coords.lng}
            className='profile-fields-display__location-map'
          />
        </Suspense>
      )}
    </div>
  );
};

const FieldValue: React.FC<{ answerType: FieldAnswerType; body: string }> = ({
  answerType,
  body,
}) => {
  if (answerType === 'longtext') {
    return <LongtextValue html={body} />;
  }

  if (answerType === 'date') {
    return <BirthdayValue body={body} />;
  }

  const text = unescapeHTML(body);

  if (answerType === 'chips') {
    return (
      <div className='profile-fields-display__pills'>
        {toChips(text).map((chip) => (
          <span className='profile-fields-display__pill' key={chip}>
            {chip}
          </span>
        ))}
      </div>
    );
  }

  if (answerType === 'link') {
    return (
      <a
        className='profile-fields-display__link'
        href={linkHref(text)}
        target='_blank'
        rel='noopener noreferrer'
      >
        <Icon
          id=''
          icon={LinkIcon}
          className='profile-fields-display__link-icon'
        />
        <span>{linkLabel(text)}</span>
      </a>
    );
  }

  return <span className='profile-fields-display__text'>{text}</span>;
};

// One field's label and answer, without any surrounding block. Exported so
// the board can place a field as a tile of its own rather than inside the
// bundled "Profile fields" section — the board is a peer arrangement of
// fields and korner shelves, not a section followed by a list
// (docs/spaces/profile.md, "the tile board").
export const ProfileFieldBody: React.FC<{
  card: ApiProfileCardJSON;
  def: ProfileFieldDef;
}> = ({ card, def }) => (
  <>
    <span className='profile-fields-display__label'>{def.label}</span>
    {def.key === 'location' ? (
      <LocationValue text={unescapeHTML(card.body)} />
    ) : (
      <FieldValue answerType={def.answerType} body={card.body} />
    )}
  </>
);
