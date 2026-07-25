import { useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetKrews } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { KornerShell } from 'mastodon/components/korner_shell';

// /hub/huddle — Huddle landing page.
//
// Two sections per the proposal design (huddle_hub_landing_wide_v1.html):
//
//   1. The Main Huddle hero tile — the perpetual singleton room.
//      Big Ѻ mark, "The Huddle", tagline, "Huddle up" button that
//      navigates to /hub/huddle/live (mounts the existing Live
//      component, which joins the shared `huddle` Jitsi room).
//
//   2. Your Krews — every Krew the current user is in that has the
//      `huddle` korner attached. Each row deep-links into the Krew's
//      own Jitsi room at /hub/huddle/krew/<slug> (which mounts the
//      Live component; the room name is derived from the slug).
//
// Participant counts are intentionally not wired in this pass. The
// hero shows "Always open. Drop in, hang out." rather than a live
// count; Krew rows read "quiet". A follow-up pass will pipe the
// Jitsi participant count through so the pulse-dot chip becomes real.
//
// Spec: docs/spaces/huddle.md.

const messages = defineMessages({
  title: { id: 'huddle.title', defaultMessage: 'Huddle' },
  hereNow: {
    id: 'huddle.hero.tagline',
    defaultMessage: 'Always open. Drop in, hang out.',
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

const HuddleLanding: React.FC = () => {
  const intl = useIntl();
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

  return (
    <div className='huddle-landing'>
      <section className='huddle-hero'>
        <div className='huddle-hero__here-chip'>
          <span className='huddle-hero__pulse' aria-hidden />
          <span className='huddle-hero__here-label'>
            {intl.formatMessage(messages.hereNow)}
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
              <li key={krew.id} className='huddle-krew-row'>
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
                    <span className='huddle-krew-row__state'>
                      <FormattedMessage {...messages.quiet} />
                    </span>
                  </span>
                  <span className='huddle-krew-row__chevron' aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
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
