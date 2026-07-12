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
import { StatusMarketplaceCard } from './status_marketplace_card';
import { StatusQuestionCard } from './status_question_card';

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
  {
    slug: 'kuestions',
    matches: (s) => {
      const pt = s.get('post_type');
      return pt === 'question' || pt === 'answer';
    },
    card: (s, ctx) => {
      const isAnswer = s.get('post_type') === 'answer';
      const questionObj = isAnswer
        ? (s.get('question') as
            | ImmutableMap<string, unknown>
            | null
            | undefined)
        : null;
      const answerersSrc = isAnswer
        ? (questionObj?.get('answerers') as
            | ImmutableMap<string, unknown>
            | null
            | undefined)
        : (s.get('answerers') as
            | ImmutableMap<string, unknown>
            | null
            | undefined);
      return (
        <StatusQuestionCard
          postType='question'
          contentHtml={
            isAnswer
              ? ((questionObj?.get('content') as string | undefined) ?? '')
              : (s.get('contentHtml') as string)
          }
          answersCount={
            isAnswer
              ? ((questionObj?.get('answers_count') as number | undefined) ?? 0)
              : (s.get('answers_count') as number | undefined)
          }
          answerers={answerersSrc?.toJS() as any}
          hasAnswered={
            isAnswer ? true : (s.get('has_answered') as boolean | undefined)
          }
          statusId={
            isAnswer
              ? (s.get('in_reply_to_id') as string)
              : (s.get('id') as string)
          }
          onCardClick={ctx.onCardClick}
        />
      );
    },
  },
  {
    slug: 'marketplace',
    matches: (s) => s.get('marketplace_listing') != null,
    card: (s) => (
      <StatusMarketplaceCard listing={dataFrom(s, 'marketplace_listing')} />
    ),
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
