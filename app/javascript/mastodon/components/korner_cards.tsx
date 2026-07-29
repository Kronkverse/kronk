// Korner framework — feed-projection card registry.
//
// Every card that appears in the home timeline for a Korner is registered
// here. Each entry declares:
//   • slug     — matches the manifest at config/korners/<slug>.yaml
//   • matches  — predicate deciding whether this card should render for a status
//   • card     — factory returning the rendered card
//
// The `card` factory receives a CardContext containing handlers the card
// needs from the outer Status component (currently just onCardClick, which
// Kuestions uses for "See all answers"). Cards that don't need it can
// ignore the ctx arg.
//
// See docs/korners/anatomy.md and docs/korners/adding_a_korner.md.

import type { ReactElement, MouseEvent } from 'react';

import type { Map as ImmutableMap } from 'immutable';

import { StatusAlbuttsCard } from './status_albutts_card';
import { StatusBoothCard } from './status_booth_card';
import { StatusEventCard } from './status_event_card';
import { StatusKommonsCard } from './status_kommons_card';
import { StatusKuestionsCard } from './status_kuestions_card';
import { StatusMomentCard } from './status_moment_card';
import { StatusTrekCard } from './status_trek_card';
import { StatusWachuneedCard } from './status_wachuneed_card';

type StatusLike = ImmutableMap<string, unknown>;

export interface CardContext {
  onCardClick: (e: MouseEvent) => void;
}

interface KornerCardEntry {
  slug: string;
  // The Status association carrying this card's data. Also the fallback
  // discriminator for statuses not yet stamped with `source_korner`.
  assocField: string;
  card: (status: StatusLike, ctx: CardContext) => ReactElement;
}

/* Dynamic dispatch by design. Each entry pulls an association out of an
 * ImmutableMap via toJS() and hands it to a specifically-typed card. TS
 * cannot verify shape at the boundary; the widening through `any` is the
 * reason no-unsafe-assignment is disabled below.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-explicit-any */

const dataFrom = (s: StatusLike, key: string): any =>
  (s.get(key) as ImmutableMap<string, unknown>).toJS();

export const KORNER_CARDS: KornerCardEntry[] = [
  {
    slug: 'kalendar',
    assocField: 'event',
    card: (s) => <StatusEventCard event={dataFrom(s, 'event')} />,
  },
  {
    slug: 'kommons',
    assocField: 'proposal',
    card: (s) => <StatusKommonsCard proposal={dataFrom(s, 'proposal')} />,
  },
  {
    slug: 'kuestions',
    assocField: 'question',
    card: (s) => <StatusKuestionsCard question={dataFrom(s, 'question')} />,
  },
  {
    slug: 'martketplace',
    assocField: 'listing',
    card: (s) => <StatusWachuneedCard listing={dataFrom(s, 'listing')} />,
  },
  {
    slug: 'booth',
    assocField: 'booth_set',
    card: (s) => <StatusBoothCard set={dataFrom(s, 'booth_set')} />,
  },
  {
    slug: 'map',
    assocField: 'trek',
    card: (s) => <StatusTrekCard trek={dataFrom(s, 'trek')} />,
  },
  {
    slug: 'moments',
    assocField: 'moment',
    card: (s) => <StatusMomentCard moment={dataFrom(s, 'moment')} />,
  },
  {
    slug: 'albutts',
    assocField: 'album',
    card: (s) => <StatusAlbuttsCard album={dataFrom(s, 'album')} />,
  },
];

/* eslint-enable @typescript-eslint/no-unsafe-assignment,
                 @typescript-eslint/no-explicit-any */

export function pickKornerCard(status: StatusLike): KornerCardEntry | null {
  // Dispatch on the `source_korner` discriminator (docs/kronk_feed_and_reach.md
  // §3.2), replacing the old per-association / post_type predicates. Fall back
  // to association presence for any status not yet stamped (transitional). The
  // card's association data must be present either way to render.
  const korner = status.get('source_korner') as string | null | undefined;

  for (const entry of KORNER_CARDS) {
    const bySlug = korner === entry.slug;
    const byAssoc = korner == null && status.get(entry.assocField) != null;
    if ((bySlug || byAssoc) && status.get(entry.assocField) != null) {
      return entry;
    }
  }

  return null;
}

export function hasKornerCard(status: StatusLike): boolean {
  return pickKornerCard(status) !== null;
}
