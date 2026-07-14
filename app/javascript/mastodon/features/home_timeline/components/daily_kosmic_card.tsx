import { useCallback, useEffect, useState } from 'react';

import { useHistory } from 'react-router-dom';

import { buildDailyIntegrationText } from 'mastodon/features/in_flow/components/daily_integration';
import { getDailyObservable } from 'mastodon/features/in_flow/components/earth_calendar';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

function getMelbourneMonthDay(): { month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '1', 10);
  return { month: get('month') - 1, day: get('day') };
}

function firstSentence(text: string): string {
  return (text.split('. ')[0] ?? text).replace(/\.$/, '') + '.';
}

export const DailyKosmicCard: React.FC = () => {
  const history = useHistory();
  const text = buildDailyIntegrationText();
  const { month, day } = getMelbourneMonthDay();
  const staticObservation = firstSentence(getDailyObservable(month, day));
  const [observation, setObservation] = useState<string>(staticObservation);

  useEffect(() => {
    fetch('/api/v1/in_flow/observation')
      .then((r) => r.json())
      .then((d: { text: string | null }) => {
        if (d.text) setObservation(firstSentence(d.text));
      })
      .catch(() => undefined);
  }, []);

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
    <button className='daily-kosmic-card' onClick={handleClick} type='button'>
      <div className='daily-kosmic-card__header'>
        <span className='daily-kosmic-card__name'>Kosmic Daily</span>
        <span className='daily-kosmic-card__date'>{today}</span>
      </div>
      <p className='daily-kosmic-card__text'>{text}</p>
      <p className='daily-kosmic-card__observation'>{observation}</p>
      <span className='daily-kosmic-card__cta'>Open In Flow →</span>
    </button>
  );
};
