import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type { ApiArtPieceJSON } from 'mastodon/api_types/art';
import { IconButton } from 'mastodon/components/icon_button';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { availabilityLabel, pieceFacts } from '../details';

// The portfolio's quick viewer (docs/spaces/art.md, Portfolio): tap a piece
// and see it whole, full screen, then step through the rest of the work on
// show (the medium picked stays picked). Its photos, its facts, and the way
// to the piece's page or to ask the artist about it.

const messages = defineMessages({
  close: { id: 'art.viewer.close', defaultMessage: 'Close' },
  previous: { id: 'art.viewer.previous', defaultMessage: 'Previous piece' },
  next: { id: 'art.viewer.next', defaultMessage: 'Next piece' },
  counter: {
    id: 'art.viewer.counter',
    defaultMessage: '{at} of {total}',
  },
  photo: {
    id: 'art.viewer.photo',
    defaultMessage: 'Photo {at} of {total}',
  },
  open: { id: 'art.viewer.open', defaultMessage: 'Open piece' },
  ask: { id: 'art.viewer.ask', defaultMessage: 'Ask about it' },
});

// A sideways drag this far is a swipe to the next or previous piece.
const SWIPE = 50;

interface Props {
  pieces: ApiArtPieceJSON[];
  initialIndex: number;
  // The medium the portfolio is narrowed to, named beside the count.
  medium: string | null;
  onClose: () => void;
}

export const ArtQuickViewer: React.FC<Props> = ({
  pieces,
  initialIndex,
  medium,
  onClose,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [index, setIndex] = useState(initialIndex);
  const [photo, setPhoto] = useState(0);
  const touchX = useRef<number | null>(null);

  const piece = pieces[index];
  const photos = piece?.photos.filter((p) => p.url) ?? [];
  const src = photos[photo]?.url ?? piece?.cover_url ?? null;

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
    setPhoto(0);
  }, []);
  const goNext = useCallback(() => {
    setIndex((i) => (i < pieces.length - 1 ? i + 1 : i));
    setPhoto(0);
  }, [pieces.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = overflow;
    };
  }, [goNext, goPrev, onClose]);

  const touchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  }, []);
  const touchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchX.current;
      const end = e.changedTouches[0]?.clientX;
      touchX.current = null;
      if (start === null || end === undefined) return;
      if (end - start > SWIPE) goPrev();
      else if (start - end > SWIPE) goNext();
    },
    [goPrev, goNext],
  );

  const pickPhoto = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPhoto(Number(e.currentTarget.value));
  }, []);

  const pieceId = piece?.id;
  const ownerId = piece?.owner.id;
  const open = useCallback(() => {
    if (pieceId) history.push(`/hub/art/pieces/${pieceId}`);
  }, [history, pieceId]);
  const ask = useCallback(() => {
    if (ownerId) history.push(`/nudges/with/${ownerId}`);
  }, [history, ownerId]);

  if (!piece) return null;

  const status = availabilityLabel(intl, piece.availability);
  const facts = pieceFacts(intl, piece);

  return createPortal(
    <div
      className='art-viewer'
      role='dialog'
      aria-modal='true'
      aria-label={piece.title}
    >
      <div className='art-viewer__top'>
        <span className='art-viewer__count'>
          {intl.formatMessage(messages.counter, {
            at: index + 1,
            total: pieces.length,
          })}
          {medium && ` · ${medium}`}
        </span>
        <IconButton
          className='art-viewer__close'
          title={intl.formatMessage(messages.close)}
          icon='close'
          iconComponent={CloseIcon}
          onClick={onClose}
        />
      </div>

      <div
        className='art-viewer__stage'
        onTouchStart={touchStart}
        onTouchEnd={touchEnd}
      >
        {index > 0 && (
          <button
            type='button'
            className='art-viewer__nav art-viewer__nav--prev'
            onClick={goPrev}
            aria-label={intl.formatMessage(messages.previous)}
          >
            <ChevronLeftIcon aria-hidden='true' />
          </button>
        )}
        {src ? (
          <img
            key={src}
            src={src}
            alt={photos[photo]?.caption ?? piece.title}
            className='art-viewer__img'
          />
        ) : (
          <div className='art-viewer__img art-viewer__img--missing' />
        )}
        {index < pieces.length - 1 && (
          <button
            type='button'
            className='art-viewer__nav art-viewer__nav--next'
            onClick={goNext}
            aria-label={intl.formatMessage(messages.next)}
          >
            <ChevronRightIcon aria-hidden='true' />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className='art-viewer__photos'>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type='button'
              value={i}
              onClick={pickPhoto}
              aria-pressed={i === photo}
              aria-label={intl.formatMessage(messages.photo, {
                at: i + 1,
                total: photos.length,
              })}
              className={`art-viewer__dot${i === photo ? ' art-viewer__dot--on' : ''}`}
            />
          ))}
        </div>
      )}

      <div className='art-viewer__info'>
        <div className='art-viewer__head'>
          <h2 className='art-viewer__title'>{piece.title}</h2>
          {status && <span className='art-viewer__status'>{status}</span>}
        </div>
        {facts.length > 0 && (
          <p className='art-viewer__facts'>{facts.join(' · ')}</p>
        )}
        <KornerActionBar>
          <KornerPill
            label={intl.formatMessage(messages.open)}
            variant='primary'
            onClick={open}
          />
          {!piece.is_owner && (
            <KornerPill
              label={intl.formatMessage(messages.ask)}
              icon={ChatIcon}
              iconId='chat'
              onClick={ask}
            />
          )}
        </KornerActionBar>
      </div>
    </div>,
    document.body,
  );
};
