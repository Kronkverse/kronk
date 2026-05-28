import { useCallback } from 'react';

import { useHistory } from 'react-router-dom';

import { buildDailyIntegrationText } from 'mastodon/features/in_flow/components/daily_integration';
import { spaceColor } from 'mastodon/planets';

export const DailyKosmicCard: React.FC = () => {
  const history = useHistory();
  const text = buildDailyIntegrationText();

  const today = new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Melbourne',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const handleClick = useCallback(() => {
    history.push('/in-flow');
  }, [history]);

  return (
    <button
      className='daily-kosmic-card'
      style={{ '--space-color': spaceColor('InFlow') } as React.CSSProperties}
      onClick={handleClick}
      type='button'
    >
      <div className='daily-kosmic-card__header'>
        <span className='daily-kosmic-card__name'>Kosmic Daily</span>
        <span className='daily-kosmic-card__date'>{today}</span>
      </div>
      <p className='daily-kosmic-card__text'>{text}</p>
      <span className='daily-kosmic-card__cta'>Open In Flow →</span>
    </button>
  );
};
