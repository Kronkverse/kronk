import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiGetKuestion,
  apiListHomeKuestions,
  apiMarkKuestionSeen,
} from 'mastodon/api/kuestions';
import type { KuestionHome } from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { SpaceGrid } from 'mastodon/components/space_grid';
import {
  CardMedia,
  CardMeta,
  CardTitle,
  StandardCard,
} from 'mastodon/components/standard_card';

import { AnswerSheet } from './answer_sheet';
import { HomeKuestionComposer } from './home_kuestion_composer';
import { RevealSheet } from './reveal_sheet';

// The Kuestions asked in a Krew or a projekt, on its page (Tal's proposal
// "Kuestions", 2026-11-08): a row of cards that scrolls sideways, the last
// one Ask, which opens the composer for this Krew or projekt. Tapping a card
// answers it in place, or shows what everyone said once you have. Only the
// Krew's members, or whoever can see the projekt, get them from the server
// (docs/spaces/kuestions.md, Kuestions in a Krew).
//
// It shows once the Krew has turned Kuestions on (Konnect → Kuestions, or
// Krew settings, Spaces; a projekt follows its Krew), Ask first when there
// are none yet. Ask opens a small composer of its own over the page
// (home_kuestion_composer.tsx), not the Kuestions composer with its deck and
// profile choices (Tal, 2026-11-08). `frame` puts the row in the page's own
// section, under its own heading.

const messages = defineMessages({
  answer: { id: 'kuestions.home.answer', defaultMessage: 'Answer it' },
  answered: { id: 'kuestions.home.answered', defaultMessage: 'Answered' },
  yours: { id: 'kuestions.home.yours', defaultMessage: 'You asked' },
  answers: {
    id: 'kuestions.home.answers',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  ask: { id: 'kuestions.home.ask', defaultMessage: 'Ask' },
  askBody: {
    id: 'kuestions.home.ask_body',
    defaultMessage: 'Ask a new Kuestion',
  },
});

interface Props {
  home: KuestionHome;
  // Members can ask (the Ask card); anyone who sees the row can answer.
  canAsk: boolean;
  onCount?: (count: number) => void;
  frame: (row: React.ReactNode) => React.ReactNode;
}

export const HomeKuestions: React.FC<Props> = ({
  home,
  canAsk,
  onCount,
  frame,
}) => {
  const intl = useIntl();
  const [asking, setAsking] = useState(false);
  const [list, setList] = useState<ApiKuestionJSON[] | null>(null);
  const [answering, setAnswering] = useState<ApiKuestionJSON | null>(null);
  const [revealing, setRevealing] = useState<ApiKuestionJSON | null>(null);
  const homeKind = home.kind;
  const homeId = home.id;

  const load = useCallback(() => {
    void apiListHomeKuestions({ kind: homeKind, id: homeId })
      .then(setList)
      .catch(() => {
        setList([]);
      });
  }, [homeKind, homeId]);

  useEffect(() => {
    setList(null);
    load();
  }, [load]);

  const count = list?.length ?? 0;
  useEffect(() => {
    onCount?.(count);
  }, [count, onCount]);

  const reveal = useCallback((id: string) => {
    void apiGetKuestion(id)
      .then((detail) => {
        setRevealing(detail);
        void apiMarkKuestionSeen(id).catch(() => undefined);
        return undefined;
      })
      .catch(() => undefined);
  }, []);

  // One you haven't answered opens to be answered; one you have (or asked)
  // opens on what everyone said.
  const handleOpen = useCallback(
    (kuestion: ApiKuestionJSON) => {
      if (kuestion.has_answered || kuestion.asked_by_me) {
        reveal(kuestion.id);
      } else {
        setAnswering(kuestion);
      }
    },
    [reveal],
  );

  const handleCancelAnswer = useCallback(() => {
    setAnswering(null);
  }, []);

  const handleAnswered = useCallback(
    (updated: ApiKuestionJSON) => {
      setAnswering(null);
      setRevealing(updated);
      load();
    },
    [load],
  );

  const handleCloseReveal = useCallback(() => {
    setRevealing(null);
  }, []);

  const handleAsk = useCallback(() => {
    setAsking(true);
  }, []);
  const handleCancelAsk = useCallback(() => {
    setAsking(false);
  }, []);
  const handleAsked = useCallback(() => {
    setAsking(false);
    load();
  }, [load]);

  // With none yet, a member still gets the Ask card.
  if (!list || (list.length === 0 && !canAsk)) return null;

  return (
    <>
      {frame(
        <SpaceGrid layout='row' className='home-kuestions'>
          {list.map((kuestion) => (
            <KuestionCard
              key={kuestion.id}
              kuestion={kuestion}
              onOpen={handleOpen}
              state={intl.formatMessage(
                kuestion.has_answered
                  ? messages.answered
                  : kuestion.asked_by_me
                    ? messages.yours
                    : messages.answer,
              )}
              answers={intl.formatMessage(messages.answers, {
                count: kuestion.answers_count,
              })}
            />
          ))}
          {canAsk && (
            <li className='space-grid__cell'>
              <StandardCard
                as='button'
                variant='grid'
                className='space-card home-kuestions__card home-kuestions__card--ask'
                onClick={handleAsk}
              >
                <CardMedia className='home-kuestions__face'>
                  <span className='home-kuestions__plus' aria-hidden='true'>
                    +
                  </span>
                </CardMedia>
                <CardTitle className='space-card__title'>
                  {intl.formatMessage(messages.ask)}
                </CardTitle>
                <CardMeta className='space-card__meta'>
                  <span className='space-card__meta-text'>
                    {intl.formatMessage(messages.askBody)}
                  </span>
                </CardMeta>
              </StandardCard>
            </li>
          )}
        </SpaceGrid>,
      )}
      {answering && (
        <AnswerSheet
          kuestion={answering}
          onCancel={handleCancelAnswer}
          onSubmitted={handleAnswered}
        />
      )}
      {revealing && (
        <RevealSheet kuestion={revealing} onNext={handleCloseReveal} />
      )}
      {asking && (
        <HomeKuestionComposer
          home={home}
          onCancel={handleCancelAsk}
          onAsked={handleAsked}
        />
      )}
    </>
  );
};

const KuestionCard: React.FC<{
  kuestion: ApiKuestionJSON;
  state: string;
  answers: string;
  onOpen: (kuestion: ApiKuestionJSON) => void;
}> = ({ kuestion, state, answers, onOpen }) => {
  const handleClick = useCallback(() => {
    onOpen(kuestion);
  }, [kuestion, onOpen]);

  return (
    <li className='space-grid__cell'>
      <StandardCard
        as='button'
        variant='grid'
        className='space-card home-kuestions__card'
        onClick={handleClick}
      >
        <CardMedia className='home-kuestions__face'>
          <span className='home-kuestions__title'>{kuestion.title}</span>
        </CardMedia>
        <CardTitle className='space-card__title'>{state}</CardTitle>
        <CardMeta className='space-card__meta'>
          <span className='space-card__meta-text'>{answers}</span>
        </CardMeta>
      </StandardCard>
    </li>
  );
};
