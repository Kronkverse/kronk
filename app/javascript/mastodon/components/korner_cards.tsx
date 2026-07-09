// Korner framework — feed-projection card registry.
//
// Companion to config/korners/*.yaml — each entry here corresponds to a
// manifest whose feed_projection.status_association names the Status
// has_one whose presence triggers the card.
//
// Kuestions is deliberately not in this registry: its card takes props
// derived from outer render state (isAnswer, handleClick), not straight
// from the Status object. Its branch stays inline in status.jsx.
//
// See docs/korners/anatomy.md and docs/korners/adding_a_korner.md.

import type { ReactElement } from 'react';

import type { Map as ImmutableMap } from 'immutable';

import { StatusBoothCard } from './status_booth_card';
import { StatusEventCard } from './status_event_card';
import { StatusKommonsCard } from './status_kommons_card';
import { StatusMarketplaceCard } from './status_marketplace_card';

type StatusLike = ImmutableMap<string, unknown>;

interface KornerCardEntry {
  slug: string;
  association: string;
  postType?: string;
  card: (status: StatusLike) => ReactElement;
}

/* This registry is dynamic dispatch by design: each entry pulls a specific
 * Status association out of an ImmutableMap and hands it — as a plain JS
 * object via toJS() — to a specifically-typed card component. TypeScript
 * cannot verify at the registry boundary that the association's shape
 * matches the card's props, so the four card factories widen through `any`.
 * That widening is why the rule is disabled for this block.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-explicit-any */

const dataFrom = (s: StatusLike, key: string): any =>
  (s.get(key) as ImmutableMap<string, unknown>).toJS();

export const KORNER_CARDS: KornerCardEntry[] = [
  {
    slug: 'kalendar',
    association: 'event',
    card: (s) => <StatusEventCard event={dataFrom(s, 'event')} />,
  },
  {
    slug: 'kommons',
    association: 'proposal',
    postType: 'proposal',
    card: (s) => <StatusKommonsCard proposal={dataFrom(s, 'proposal')} />,
  },
  {
    slug: 'marketplace',
    association: 'marketplace_listing',
    card: (s) => (
      <StatusMarketplaceCard listing={dataFrom(s, 'marketplace_listing')} />
    ),
  },
  {
    slug: 'booth',
    association: 'booth_set',
    card: (s) => <StatusBoothCard set={dataFrom(s, 'booth_set')} />,
  },
];

/* eslint-enable @typescript-eslint/no-unsafe-assignment,
                 @typescript-eslint/no-explicit-any */

export function pickKornerCard(status: StatusLike): KornerCardEntry | null {
  for (const entry of KORNER_CARDS) {
    if (status.get(entry.association) == null) continue;
    if (entry.postType != null && status.get('post_type') !== entry.postType) continue;
    return entry;
  }
  return null;
}

export function hasKornerCard(status: StatusLike): boolean {
  const postType = status.get('post_type');
  if (postType === 'question' || postType === 'answer') return true;
  return pickKornerCard(status) !== null;
}
