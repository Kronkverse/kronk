import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { StatusAlbuttsCard } from 'mastodon/components/status_albutts_card';
import { StatusBoothCard } from 'mastodon/components/status_booth_card';
import { StatusEventCard } from 'mastodon/components/status_event_card';
import { StatusKommonsCard } from 'mastodon/components/status_kommons_card';
import { StatusKuestionsCard } from 'mastodon/components/status_kuestions_card';
import { StatusTrekCard } from 'mastodon/components/status_trek_card';
import { StatusWachuneedCard } from 'mastodon/components/status_wachuneed_card';

// Drawn shelf — a query over the account's posts, resolved at read
// time via `/api/v1/accounts/:id/profile/sections/:section_id/statuses`
// and rendered via the existing korner-card components.
//
// The render key is the korner manifest's `feed_projection.card`, which
// is what the Library hands the section selector and what the selector
// stores in `settings.render`. That is the name to dispatch on:
//
//   albutts_card    → StatusAlbuttsCard
//   booth_card      → StatusBoothCard
//   trek_card       → StatusTrekCard
//   wachuneed_card  → StatusWachuneedCard
//   kuestions_card  → StatusKuestionsCard
//   kommons_card    → StatusKommonsCard
//   event_card      → StatusEventCard
//   longform        → LongformCard (this file — no dedicated korner card)
//   photo           → PhotoTile   (this file — media excerpt)
//   *               → excerpt fallback
//
// It used to dispatch on short names (`album`, `track`, `trek`) that no
// manifest ever produced, so EVERY korner shelf fell through to the
// excerpt fallback and rendered as a line of text labelled
// "ALBUTTS_CARD". The short names survive as aliases below because rows
// written before this fix carry them.
//
// One korner per screen (docs/spaces/profile.md, "The profile board").
// The shelf renders as a band about 80% of the Stage tall, and the rail
// inside it snaps per card so a swipe lands on a whole one. Vertical
// scroll moves between korners, horizontal swipe moves within one.
//
// A shelf with no posts renders nothing at all — the owner turned it on
// before posting into that korner, and Arrange is where they should hear
// about it, not a visitor's read of the page.

const messages = defineMessages({
  loading: {
    id: 'profile_shelves.drawn.loading',
    defaultMessage: 'Loading…',
  },
  empty: {
    id: 'profile_shelves.drawn.empty',
    defaultMessage: 'Nothing here yet.',
  },
  untitled: {
    id: 'profile_shelves.drawn.untitled',
    defaultMessage: 'Shelf',
  },
  position: {
    id: 'profile_shelves.drawn.position',
    defaultMessage: '{current} of {total}',
  },
});

// Short names written into `settings.render` before the manifest card
// names became the dispatch key. Normalised on read so an existing shelf
// renders correctly without a data migration.
const RENDER_ALIASES: Record<string, string> = {
  album: 'albutts_card',
  track: 'booth_card',
  trek: 'trek_card',
  listing: 'wachuneed_card',
  answers: 'kuestions_card',
};

const canonicalRender = (render: string): string =>
  RENDER_ALIASES[render] ?? render;

const SOURCE_LABEL: Record<string, string> = {
  albutts_card: 'Albutts',
  booth_card: 'The Booth',
  trek_card: 'Map',
  wachuneed_card: 'Wachuneed',
  kuestions_card: 'Kuestions',
  kommons_card: 'Kommons',
  event_card: 'Kalendar',
  huddle_card: 'Huddle',
  longform: 'Long reads',
  photo: 'Photos',
  moment: 'Moments',
  chips: 'Kategory',
  korner: 'Korner',
};

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const longformExcerpt = (status: ApiStatusJSON) => {
  const raw = status.content ?? status.text ?? '';
  return stripHtml(raw).slice(0, 240);
};

const readingMinutes = (status: ApiStatusJSON) => {
  const text = stripHtml(status.content ?? status.text ?? '');
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 220));
};

interface LongformCardProps {
  status: ApiStatusJSON;
}

const LongformCard: React.FC<LongformCardProps> = ({ status }) => {
  const excerpt = longformExcerpt(status);
  const minutes = readingMinutes(status);
  const created = new Date(status.created_at).toLocaleDateString();
  return (
    <a
      className='profile-shelves__drawn-card profile-shelves__drawn-longform'
      href={`/@${status.account.acct}/${status.id}`}
    >
      <div className='profile-shelves__drawn-longform-excerpt'>{excerpt}</div>
      <div className='profile-shelves__drawn-longform-meta'>
        {minutes} min · {created}
      </div>
    </a>
  );
};

interface PhotoTileProps {
  status: ApiStatusJSON;
}

const PhotoTile: React.FC<PhotoTileProps> = ({ status }) => {
  const media = status.media_attachments[0];
  if (!media) return null;
  return (
    <a
      className='profile-shelves__drawn-card profile-shelves__drawn-photo'
      href={`/@${status.account.acct}/${status.id}`}
    >
      <img
        alt={media.description ?? ''}
        src={media.preview_url}
        className='profile-shelves__drawn-photo-img'
        loading='lazy'
      />
    </a>
  );
};

interface ExcerptCardProps {
  status: ApiStatusJSON;
  source: string;
}

const ExcerptCard: React.FC<ExcerptCardProps> = ({ status, source }) => {
  const excerpt = longformExcerpt(status);
  return (
    <a
      className='profile-shelves__drawn-card profile-shelves__drawn-excerpt'
      href={`/@${status.account.acct}/${status.id}`}
    >
      <div className='profile-shelves__drawn-excerpt-source'>{source}</div>
      <div className='profile-shelves__drawn-excerpt-text'>{excerpt}</div>
    </a>
  );
};

// Some korner associations aren't yet declared on `ApiStatusJSON` —
// the backend serializes them (album, booth_set, listing) but the
// shared type predates them. Cast through unknown to reach the
// korner-card component's own shape at the render boundary.
type WithKornerData = ApiStatusJSON & {
  album?: unknown;
  booth_set?: unknown;
  listing?: unknown;
  proposal?: unknown;
  event?: unknown;
};

interface StatusCardProps {
  status: ApiStatusJSON;
  render: string;
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-explicit-any */

const StatusCard: React.FC<StatusCardProps> = ({ status, render }) => {
  const s = status as WithKornerData;
  switch (canonicalRender(render)) {
    case 'albutts_card':
      return s.album ? <StatusAlbuttsCard album={s.album as any} /> : null;
    case 'booth_card':
      return s.booth_set ? <StatusBoothCard set={s.booth_set as any} /> : null;
    case 'trek_card':
      return status.trek ? <StatusTrekCard trek={status.trek as any} /> : null;
    case 'wachuneed_card':
      return s.listing ? (
        <StatusWachuneedCard listing={s.listing as any} />
      ) : null;
    case 'kuestions_card':
      return status.question ? (
        <StatusKuestionsCard question={status.question as any} />
      ) : null;
    case 'kommons_card':
      return s.proposal ? (
        <StatusKommonsCard proposal={s.proposal as any} />
      ) : null;
    case 'event_card':
      return s.event ? <StatusEventCard event={s.event as any} /> : null;
    case 'longform':
      return <LongformCard status={status} />;
    case 'photo':
      return <PhotoTile status={status} />;
    default:
      return (
        <ExcerptCard status={status} source={SOURCE_LABEL[render] ?? render} />
      );
  }
};

/* eslint-enable @typescript-eslint/no-unsafe-assignment,
                 @typescript-eslint/no-explicit-any */

interface ShelfDrawnProps {
  accountId: string;
  section: ApiProfileSectionJSON;
}

// Renders that lead with an image fill the band; the rest sit at their own
// height and the band shrinks to them. Stretching a three-line proposal to
// 560px makes a poster out of a sentence — and leaves the void the first
// build of this showed on a real profile.
const FILLS_BAND = new Set(['albutts_card', 'trek_card', 'photo']);

export const ShelfDrawn: React.FC<ShelfDrawnProps> = ({
  accountId,
  section,
}) => {
  const intl = useIntl();

  const [statuses, setStatuses] = useState<ApiStatusJSON[] | null>(null);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatuses(null);
    setActive(0);
    void apiRequestGet<ApiStatusJSON[]>(
      `v1/accounts/${accountId}/profile/sections/${section.id}/statuses`,
    )
      .then((data) => {
        if (!cancelled) setStatuses(data);
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, section.id]);

  // Which card the rail has settled on, for the counter. Read from the DOM on
  // scroll rather than tracked as state the swipe has to stay in sync with —
  // the scroll position is the truth, and an IntersectionObserver would report
  // two cards during a swipe where this reports the nearer one.
  const handleScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const items = Array.from(rail.children) as HTMLElement[];
    const first = items[0];
    if (!first) return;

    let nearest = 0;
    let shortest = Infinity;
    items.forEach((item, index) => {
      const distance = Math.abs(
        item.offsetLeft - first.offsetLeft - rail.scrollLeft,
      );
      if (distance < shortest) {
        shortest = distance;
        nearest = index;
      }
    });
    setActive(nearest);
  }, []);

  const settings = section.settings;
  const render = canonicalRender(
    typeof settings.render === 'string' ? settings.render : 'korner',
  );
  const source = SOURCE_LABEL[render] ?? render;
  const title =
    section.title ??
    SOURCE_LABEL[render] ??
    intl.formatMessage(messages.untitled);

  // An empty shelf is not a band of nothing. The owner turned it on and has
  // yet to post into that korner; the place to tell them so is Arrange, not
  // the page a visitor reads.
  if (statuses !== null && statuses.length === 0) return null;

  const classes = [
    'profile-shelves__shelf',
    'profile-shelves__shelf--drawn',
    `profile-shelves__shelf--drawn-${render}`,
    'profile-shelves__shelf--band',
    FILLS_BAND.has(render) ? 'profile-shelves__shelf--fills' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes}>
      <header className='profile-shelves__shelf-head'>
        <h3 className='profile-shelves__shelf-title'>{title}</h3>
        <span className='profile-shelves__shelf-meta'>
          <span className='profile-shelves__shelf-source'>↳ {source}</span>
          {statuses && statuses.length > 1 && (
            <span
              className='profile-shelves__shelf-counter'
              aria-label={intl.formatMessage(messages.position, {
                current: active + 1,
                total: statuses.length,
              })}
            >
              {active + 1} / {statuses.length}
            </span>
          )}
        </span>
      </header>
      {statuses === null ? (
        <div className='profile-shelves__drawn-placeholder'>
          {intl.formatMessage(messages.loading)}
        </div>
      ) : (
        <ul
          className='profile-shelves__drawn-rail'
          ref={railRef}
          onScroll={handleScroll}
        >
          {statuses.map((status) => (
            <li key={status.id} className='profile-shelves__drawn-rail-item'>
              <StatusCard status={status} render={render} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
