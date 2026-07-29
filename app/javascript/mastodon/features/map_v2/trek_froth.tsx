import { useState, useEffect, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import HeartFillIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import HeartIcon from '@/material-icons/400-24px/favorite.svg?react';
import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

// Map — froth on a published trek. Froth is a Favourite on the trek's timeline
// Status (Kronk vocabulary), so it's the same underlying interaction as the
// feed's froth button — frothing here reflects in the feed and vice versa. We
// read/write the British `favourited`/`favourites_count` the API actually
// emits (the ApiStatusJSON type mislabels them, so we type them narrowly here).

const messages = defineMessages({
  froth: { id: 'map.treks.froth', defaultMessage: 'Froth' },
  frothed: { id: 'map.treks.frothed', defaultMessage: 'Frothed' },
});

interface FrothState {
  favourited?: boolean;
  favourites_count: number;
}

export const TrekFroth: React.FC<{ statusId: string }> = ({ statusId }) => {
  const intl = useIntl();
  const [frothed, setFrothed] = useState(false);
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(false);

  const apply = useCallback((s: FrothState) => {
    setFrothed(Boolean(s.favourited));
    setCount(s.favourites_count);
  }, []);

  useEffect(() => {
    void apiRequestGet<FrothState>(`v1/statuses/${statusId}`)
      .then(apply)
      .catch(() => undefined);
  }, [statusId, apply]);

  const toggle = useCallback(() => {
    if (pending) return;
    setPending(true);
    const action = frothed ? 'unfavourite' : 'favourite';
    void apiRequestPost<FrothState>(`v1/statuses/${statusId}/${action}`)
      .then(apply)
      .finally(() => {
        setPending(false);
      });
  }, [frothed, pending, statusId, apply]);

  return (
    <button
      type='button'
      className={classNames('trek-froth', { 'trek-froth--active': frothed })}
      onClick={toggle}
      disabled={pending}
      aria-pressed={frothed}
    >
      <Icon
        id='favourite'
        icon={frothed ? HeartFillIcon : HeartIcon}
        className='trek-froth__icon'
      />
      <span className='trek-froth__label'>
        {intl.formatMessage(frothed ? messages.frothed : messages.froth)}
      </span>
      {count > 0 && <span className='trek-froth__count'>{count}</span>}
    </button>
  );
};
