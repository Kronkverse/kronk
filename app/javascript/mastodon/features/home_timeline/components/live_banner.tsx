import { useState, useEffect, useCallback } from 'react';

import { useHistory } from 'react-router-dom';

import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';
import { apiRequestGet } from 'mastodon/api';

// How many are in the Main Huddle, from Kronk's own count
// (GET /api/v1/huddle/count). It used to ask the Jitsi server from every
// browser, which answers an empty room with a 404 that the browser logs as
// a failed load on every poll.
const POLL_INTERVAL = 15000;

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

  if (!visible) return null;

  return (
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
  );
};
