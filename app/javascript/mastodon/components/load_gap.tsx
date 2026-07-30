import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import MoreHorizIcon from '@/material-icons/400-24px/more_horiz.svg?react';
import { Icon } from 'mastodon/components/icon';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';

const messages = defineMessages({
  load_more: { id: 'status.load_more', defaultMessage: 'Load more' },
});

interface Props<T> {
  disabled: boolean;
  param: T;
  onClick: (params: T) => void;
}

export const LoadGap = <T,>({ disabled, param, onClick }: Props<T>) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firedRef = useRef(false);

  const handleClick = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setLoading(true);
    onClick(param);
  }, [param, onClick]);

  // Auto-load the gap when it comes near the viewport. The user
  // shouldn't have to manually resolve a data-continuity concern; if
  // scrolling toward missing statuses, silently fetch them so the feed
  // just closes up. Fires once per gap; if the fetch fails and the gap
  // stays in the DOM, the button is still clickable as a fallback.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || disabled || firedRef.current) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          handleClick();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [disabled, handleClick]);

  return (
    <button
      ref={buttonRef}
      className='load-more load-gap'
      disabled={disabled}
      onClick={handleClick}
      aria-label={intl.formatMessage(messages.load_more)}
      title={intl.formatMessage(messages.load_more)}
    >
      {loading ? (
        <LoadingIndicator />
      ) : (
        <Icon id='ellipsis-h' icon={MoreHorizIcon} />
      )}
    </button>
  );
};
