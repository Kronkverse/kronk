import { useCallback } from 'react';

import { useHistory } from 'react-router-dom';

import { huddleLeft } from 'mastodon/actions/huddle';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

export const HuddlePip: React.FC = () => {
  const dispatch = useAppDispatch();
  const history = useHistory();

  const active = useAppSelector((state) => state.huddle.active);
  const minimized = useAppSelector((state) => state.huddle.minimized);
  const participantCount = useAppSelector(
    (state) => state.huddle.participantCount,
  );

  const handleLeave = useCallback(() => {
    dispatch(huddleLeft());
  }, [dispatch]);

  const handleReturn = useCallback(() => {
    history.push('/huddle');
  }, [history]);

  if (!active || !minimized) return null;

  return (
    <div className='huddle-pip'>
      <div className='huddle-pip__status'>
        <div className='huddle-pip__dot' />
        <span className='huddle-pip__label'>Huddle</span>
        {participantCount > 0 && (
          <span className='huddle-pip__count'>
            {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>
      <div className='huddle-pip__actions'>
        <button className='huddle-pip__return' onClick={handleReturn}>
          Return
        </button>
        <button className='huddle-pip__leave' onClick={handleLeave}>
          Leave
        </button>
      </div>
    </div>
  );
};
