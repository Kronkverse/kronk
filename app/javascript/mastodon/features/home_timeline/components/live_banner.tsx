import { useState, useEffect, useCallback } from 'react';

import { useHistory } from 'react-router-dom';

import Diversity2Icon from '@/material-icons/400-24px/diversity_2-fill.svg?react';


const JITSI_DOMAIN = 'meet.talitamoss.info';
const ROOM_NAME = 'huddle';
const POLL_INTERVAL = 15000;

export const LiveBanner: React.FC = () => {
  const [participantCount, setParticipantCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const history = useHistory();

  const checkRoom = useCallback(async () => {
    try {
      const url =
        'https://' +
        JITSI_DOMAIN +
        '/room-size?room=' +
        ROOM_NAME +
        '&domain=meet.jitsi';
      const sizeRes = await fetch(url);

      if (sizeRes.status === 404) {
        setVisible(false);
        setParticipantCount(0);
        return;
      }

      if (sizeRes.ok) {
        const sizeData = (await sizeRes.json()) as { participants: number };
        const count = sizeData.participants;
        setParticipantCount(count);

        if (count > 0) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      }
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
