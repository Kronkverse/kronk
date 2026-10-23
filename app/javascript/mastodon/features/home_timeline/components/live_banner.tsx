import { useState, useEffect, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import { apiRequestGet } from 'mastodon/api';

// How many are in the Main Huddle, from Kronk's own count
// (GET /api/v1/huddle/count). It used to ask the Jitsi server from every
// browser, which answers an empty room with a 404 that the browser logs as
// a failed load on every poll.
const POLL_INTERVAL = 15000;

// Who's playing live in the Booth (GET /api/v1/booth_lives/now, empty for
// anyone tuned out of the Booth; docs/spaces/booth.md, Live sets). One
// banner per set, newest first; past two it becomes one banner for all.
const BOOTH_POLL_INTERVAL = 30000;

interface BoothLiveBrief {
  id: string;
  title: string;
  account: { display_name: string; username: string };
}

const messages = defineMessages({
  boothLive: {
    id: 'live_banner.booth',
    defaultMessage: '{name} is live in the Booth: {title}',
  },
  boothMany: {
    id: 'live_banner.booth_many',
    defaultMessage: '{count} live sets in the Booth right now',
  },
  listen: { id: 'live_banner.listen', defaultMessage: 'Listen in' },
});

const BoothLiveBanners: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const [lives, setLives] = useState<BoothLiveBrief[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const now = await apiRequestGet<BoothLiveBrief[]>('v1/booth_lives/now');
        if (!cancelled) setLives(now);
      } catch {
        if (!cancelled) setLives([]);
      }
    };
    void load();
    const interval = setInterval(() => void load(), BOOTH_POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const id = e.currentTarget.dataset.id;
      history.push(id ? `/hub/booth/live/${id}` : '/hub/booth/live');
    },
    [history],
  );

  if (lives.length === 0) return null;

  if (lives.length > 2) {
    return (
      <button
        className='live-banner live-banner--booth'
        onClick={handleOpen}
        type='button'
      >
        <div className='live-banner__pulse' />
        <HeadphonesIcon className='live-banner__icon' />
        <div className='live-banner__content'>
          <span className='live-banner__text'>
            {intl.formatMessage(messages.boothMany, { count: lives.length })}
          </span>
        </div>
        <span className='live-banner__join'>
          {intl.formatMessage(messages.listen)}
        </span>
      </button>
    );
  }

  return (
    <>
      {lives.map((live) => (
        <button
          key={live.id}
          className='live-banner live-banner--booth'
          onClick={handleOpen}
          data-id={live.id}
          type='button'
        >
          <div className='live-banner__pulse' />
          <HeadphonesIcon className='live-banner__icon' />
          <div className='live-banner__content'>
            <span className='live-banner__text'>
              {intl.formatMessage(messages.boothLive, {
                name: (
                  <strong key='name'>
                    {live.account.display_name || live.account.username}
                  </strong>
                ),
                title: live.title,
              })}
            </span>
          </div>
          <span className='live-banner__join'>
            {intl.formatMessage(messages.listen)}
          </span>
        </button>
      ))}
    </>
  );
};

export const LiveBanner: React.FC = () => {
  const [participantCount, setParticipantCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const history = useHistory();

  const checkRoom = useCallback(async () => {
    try {
      const { participants } = await apiRequestGet<{ participants: number }>(
        'v1/huddle/count',
      );
      setParticipantCount(participants);
      setVisible(participants > 0);
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void checkRoom();
    const interval = setInterval(() => void checkRoom(), POLL_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [checkRoom]);

  const handleClick = useCallback(() => {
    history.push('/huddle');
  }, [history]);

  return (
    <>
      <BoothLiveBanners />
      {visible && (
        <button className='live-banner' onClick={handleClick} type='button'>
          <div className='live-banner__pulse' />
          <Diversity2Icon className='live-banner__icon' />
          <div className='live-banner__content'>
            <span className='live-banner__text'>
              <strong>{participantCount}</strong>{' '}
              {participantCount === 1 ? 'user' : 'users'} Huddling
            </span>
          </div>
          <span className='live-banner__join'>Huddle Up</span>
        </button>
      )}
    </>
  );
};
