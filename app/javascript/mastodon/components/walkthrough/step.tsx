import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { IconButton } from 'mastodon/components/icon_button';

import { useAnchorPosition } from './use_anchor_position';

const messages = defineMessages({
  close: { id: 'walkthrough.close', defaultMessage: 'Close tour' },
  back: { id: 'walkthrough.back', defaultMessage: 'Back' },
  next: { id: 'walkthrough.next', defaultMessage: 'Next' },
  finish: { id: 'walkthrough.finish', defaultMessage: 'Finish' },
  dontShow: {
    id: 'walkthrough.dont_show_again',
    defaultMessage: "Don't show this again",
  },
  ariaDialog: {
    id: 'walkthrough.aria_dialog',
    defaultMessage: 'Walkthrough step {step} of {total}: {title}',
  },
});

interface Props {
  index: number;
  total: number;
  title: string;
  body: ReactNode;
  anchor: string | null;
  dontShow: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onToggleDontShow: (value: boolean) => void;
}

export const WalkthroughStep: React.FC<Props> = ({
  index,
  total,
  title,
  body,
  anchor,
  dontShow,
  onPrev,
  onNext,
  onClose,
  onToggleDontShow,
}) => {
  const intl = useIntl();
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { rect, bubble, arrow } = useAnchorPosition({
    anchor,
    bubbleEl: bubbleRef.current,
    seed: index,
  });

  const isLast = index === total - 1;

  const handleDontShow = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggleDontShow(e.target.checked);
    },
    [onToggleDontShow],
  );

  // Focus the Next button on show so keyboard users advance with Enter
  // without hunting.
  useEffect(() => {
    const el = bubbleRef.current?.querySelector<HTMLButtonElement>(
      '.walkthrough-bubble__btn--next',
    );
    el?.focus();
  }, [index]);

  return (
    <>
      <div
        className={`walkthrough-backdrop${rect ? ' walkthrough-backdrop--spotlit' : ''}`}
        aria-hidden
      >
        {rect && (
          <div
            className='walkthrough-backdrop__hole'
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        )}
      </div>

      <div
        ref={bubbleRef}
        className='walkthrough-bubble'
        role='dialog'
        aria-live='polite'
        aria-label={intl.formatMessage(messages.ariaDialog, {
          step: index + 1,
          total,
          title,
        })}
        style={
          bubble
            ? { top: bubble.top, left: bubble.left, right: 'auto' }
            : undefined
        }
      >
        {arrow && (
          <div
            className={`walkthrough-bubble__arrow walkthrough-bubble__arrow--${arrow.side}`}
            style={{
              [arrow.side === 'top' || arrow.side === 'bottom'
                ? 'left'
                : 'top']: `${arrow.offset}px`,
            }}
            aria-hidden
          />
        )}

        <div className='walkthrough-bubble__header'>
          <h2 className='walkthrough-bubble__title'>{title}</h2>
          <IconButton
            title={intl.formatMessage(messages.close)}
            icon='close'
            iconComponent={CloseIcon}
            onClick={onClose}
          />
        </div>

        <div className='walkthrough-bubble__body'>{body}</div>

        <div className='walkthrough-bubble__progress'>
          <div className='walkthrough-bubble__dots' aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`walkthrough-bubble__dot${i === index ? ' walkthrough-bubble__dot--active' : ''}${i < index ? ' walkthrough-bubble__dot--seen' : ''}`}
              />
            ))}
          </div>
          <div className='walkthrough-bubble__counter'>
            {index + 1} / {total}
          </div>
        </div>

        <div className='walkthrough-bubble__actions'>
          <button
            type='button'
            className='walkthrough-bubble__btn walkthrough-bubble__btn--prev'
            onClick={onPrev}
            disabled={index === 0}
          >
            ← {intl.formatMessage(messages.back)}
          </button>
          <button
            type='button'
            className='walkthrough-bubble__btn walkthrough-bubble__btn--next'
            onClick={onNext}
          >
            {isLast
              ? intl.formatMessage(messages.finish)
              : intl.formatMessage(messages.next)}
            {!isLast && ' →'}
          </button>
        </div>

        <label className='walkthrough-bubble__dontshow'>
          <input type='checkbox' checked={dontShow} onChange={handleDontShow} />
          {intl.formatMessage(messages.dontShow)}
        </label>
      </div>
    </>
  );
};
