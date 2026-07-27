import { useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { KornerShell } from 'mastodon/components/korner_shell';

import { useRoomPresence } from './use_room_presence';

// /hub/huddle — Huddle landing page.
//
// Two sections per the proposal design (huddle_hub_landing_wide_v1.html):
//
//   1. The Main Huddle hero tile — the perpetual singleton room.
//      "N here now" chip, big Ѻ mark, "The Huddle", tagline,
//      "Huddle up" button that navigates to /hub/huddle/live.
//
//   2. Your Krews — every Krew the current user is in that has the
//      `huddle` korner attached. Each row deep-links into the Krew's
//      own Jitsi room at /hub/huddle/krew/<slug>. Rows show "N here"
//      when the room is populated and "quiet" otherwise.
//
// Presence counts come from the Jitsi Prosody room-info endpoint via
// useRoomPresence(). Same source the Live component's lobby uses —
// polled every 15s, CORS-open, best-effort (a 404 or fetch failure
// degrades to 0).
//
// Spec: docs/spaces/huddle.md.

const MAIN_ROOM_NAME = 'huddle';

const messages = defineMessages({
  title: { id: 'huddle.title', defaultMessage: 'Huddle' },
  tagline: {
    id: 'huddle.hero.tagline',
    defaultMessage: 'Always open. Drop in, hang out.',
  },
  hereNow: {
    id: 'huddle.chip.here_now',
    defaultMessage:
      '{count, plural, =0 {no one here yet} one {# here now} other {# here now}}',
  },
  hereShort: {
    id: 'huddle.krew.here_short',
    defaultMessage: '{count, plural, one {# here} other {# here}}',
  },
  huddleUp: {
    id: 'huddle.hero.cta',
    defaultMessage: 'Huddle up',
  },
  yourKrews: {
    id: 'huddle.krews.heading',
    defaultMessage: 'Your Krews',
  },
  quiet: {
    id: 'huddle.krew.quiet',
    defaultMessage: 'quiet',
  },
  krewsEmpty: {
    id: 'huddle.krews.empty',
    defaultMessage: 'No Krew Huddles yet. Attach one when you create a Krew.',
  },
});

// Colour rotation for the Krew avatar plates when the Krew hasn't
// supplied its own — matches the palette hinted at in the prototype
// (warm ochre, jade, purple, rose).
const AVATAR_COLORS = ['#e6a857', '#38b2a3', '#7241ff', '#c65d8e'] as const;

const avatarColor = (index: number) =>
  AVATAR_COLORS[index % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];

// First letter of the Krew's name, uppercased, for the placeholder
// avatar tile. Falls back to the first slug character.
const avatarGlyph = (krew: ApiKrewJSON): string =>
  (krew.name.trim()[0] ?? krew.slug[0] ?? '?').toUpperCase();

interface KrewRowProps {
  krew: ApiKrewJSON;
  index: number;
}

const KrewRow: React.FC<KrewRowProps> = ({ krew, index }) => {
  const intl = useIntl();
  const count = useRoomPresence(`huddle-krew-${krew.slug}`);
  const populated = count !== null && count > 0;

  return (
    <li className='huddle-krew-row'>
      <Link
        to={`/hub/huddle/krew/${krew.slug}`}
        className='huddle-krew-row__link'
      >
        <span
          className='huddle-krew-row__avatar'
          style={{ background: avatarColor(index) }}
          aria-hidden
        >
          {avatarGlyph(krew)}
        </span>
        <span className='huddle-krew-row__body'>
          <span className='huddle-krew-row__name'>{krew.name}</span>
          <span
            className={`huddle-krew-row__state ${populated ? 'huddle-krew-row__state--live' : ''}`}
          >
            {populated && (
              <span className='huddle-krew-row__pulse' aria-hidden />
            )}
            {populated
              ? intl.formatMessage(messages.hereShort, { count })
              : intl.formatMessage(messages.quiet)}
          </span>
        </span>
        <span className='huddle-krew-row__chevron' aria-hidden>
          ›
        </span>
      </Link>
    </li>
  );
};

const HuddleLanding: React.FC = () => {
  const intl = useIntl();
  const mainCount = useRoomPresence(MAIN_ROOM_NAME);
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
  const [loading, setLoading] = useState(true);
  // Ref rather than a local `let` so eslint's flow analysis doesn't
  // flag the closure guards as tautological.
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    void (async () => {
      try {
        const data = await apiGetKrews({ scope: 'mine', limit: 40 });
        if (cancelledRef.current) return;
        setKrews(data.filter((k) => k.korners.includes('huddle')));
      } catch {
        // Empty list is a fine failure mode — the page still shows
        // the Main Huddle hero.
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const mainPopulated = mainCount !== null && mainCount > 0;

  return (
    <div className='huddle-landing'>
      <section className='huddle-hero'>
        <div
          className={`huddle-hero__here-chip ${mainPopulated ? 'huddle-hero__here-chip--live' : ''}`}
        >
          {mainPopulated && <span className='huddle-hero__pulse' aria-hidden />}
          <span className='huddle-hero__here-label'>
            {mainCount === null
              ? intl.formatMessage(messages.tagline)
              : intl.formatMessage(messages.hereNow, { count: mainCount })}
          </span>
        </div>
        <div className='huddle-hero__mark' aria-hidden>
          Ѻ
        </div>
        <h2 className='huddle-hero__title'>
          <FormattedMessage
            id='huddle.hero.title'
            defaultMessage='The Huddle'
          />
        </h2>
        <p className='huddle-hero__tagline'>
          <FormattedMessage {...messages.tagline} />
        </p>
        <Link to='/hub/huddle/live' className='huddle-hero__cta'>
          <FormattedMessage {...messages.huddleUp} />
        </Link>
      </section>

      <div className='huddle-krews'>
        <div className='huddle-krews__head'>
          <span className='huddle-krews__label'>
            <FormattedMessage {...messages.yourKrews} />
          </span>
          {!loading && krews.length > 0 && (
            <span className='huddle-krews__count'>{krews.length}</span>
          )}
        </div>

        {!loading && krews.length === 0 && (
          <p className='huddle-krews__empty'>
            <FormattedMessage {...messages.krewsEmpty} />
          </p>
        )}

        {krews.length > 0 && (
          <ul className='huddle-krews__list'>
            {krews.map((krew, index) => (
              <KrewRow key={krew.id} krew={krew} index={index} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const Huddle: React.FC = () => {
  const intl = useIntl();
  return (
    <KornerShell
      slug='huddle'
      label={intl.formatMessage(messages.title)}
      className='scrollable huddle'
      defaultView='landing'
      views={{
        landing: () => <HuddleLanding />,
      }}
    />
  );
};
