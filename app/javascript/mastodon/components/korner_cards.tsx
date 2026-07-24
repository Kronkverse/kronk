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

import { StatusBoothCard } from './status_booth_card';
import { StatusEventCard } from './status_event_card';
import { StatusKommonsCard } from './status_kommons_card';
import { StatusWachuneedCard } from './status_wachuneed_card';

type StatusLike = ImmutableMap<string, unknown>;

export interface CardContext {
  onCardClick: (e: MouseEvent) => void;
}

interface KornerCardEntry {
  slug: string;
  matches: (status: StatusLike) => boolean;
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
    matches: (s) => s.get('event') != null,
    card: (s) => <StatusEventCard event={dataFrom(s, 'event')} />,
  },
  {
    slug: 'kommons',
    matches: (s) =>
      s.get('post_type') === 'proposal' && s.get('proposal') != null,
    card: (s) => <StatusKommonsCard proposal={dataFrom(s, 'proposal')} />,
  },
  // Kuestions feed projection is out of scope for the rebuild — the
  // Status-polymorphic path retired in Phase 3a. The kuestions_card
  // per §Feed projection (docs/spaces/kuestions.md §Phase 8.3) will
  // return here backed by the dedicated Question model.
  {
    slug: 'martketplace',
    matches: (s) => s.get('listing') != null,
    card: (s) => <StatusWachuneedCard listing={dataFrom(s, 'listing')} />,
  },
  {
    slug: 'booth',
    matches: (s) => s.get('booth_set') != null,
    card: (s) => <StatusBoothCard set={dataFrom(s, 'booth_set')} />,
  },
];

/* eslint-enable @typescript-eslint/no-unsafe-assignment,
                 @typescript-eslint/no-explicit-any */

export function pickKornerCard(status: StatusLike): KornerCardEntry | null {
  for (const entry of KORNER_CARDS) {
    if (entry.matches(status)) return entry;
  }
  return null;
}

export function hasKornerCard(status: StatusLike): boolean {
  return pickKornerCard(status) !== null;
}
