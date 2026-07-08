import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import type { KlotPeriod } from '../types';
import { todayISO } from '../phase_math';

const messages = defineMessages({
  logToday: {
    id: 'klot.log.today',
    defaultMessage: 'Log a period starting today',
  },
  mostRecent: {
    id: 'klot.log.most_recent',
    defaultMessage: 'Most recent period started',
  },
  removeLog: {
    id: 'klot.log.remove',
    defaultMessage: 'Remove log',
  },
  loggedToast: {
    id: 'klot.log.logged_toast',
    defaultMessage: "Logged. You’re on Day 1 — Menstrual.",
  },
});

interface Props {
  periods: KlotPeriod[];
  onLog: (startedOn: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const LogCard: React.FC<Props> = ({ periods, onLog, onDelete }) => {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const mostRecent = periods[0]?.started_on ?? '';

  const handleLogToday = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onLog(todayISO());
      setToast(intl.formatMessage(messages.loggedToast));
      window.setTimeout(() => {
        setToast('');
      }, 3200);
    } finally {
      setBusy(false);
    }
  }, [busy, onLog, intl]);

  const handleDateChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (!value) return;
      await onLog(value);
    },
    [onLog],
  );

  return (
    <div className='klot-card'>
      <h3 className='klot-card__title serif'>
        <FormattedMessage id='klot.log.title' defaultMessage='Your log' />
      </h3>
      <p className='klot-card__lead'>
        <FormattedMessage
          id='klot.log.lead'
          defaultMessage='Add a period whenever one starts. Your latest entry sets where you are now.'
        />
      </p>

      <button
        type='button'
        className='klot-primary-btn'
        onClick={handleLogToday}
        disabled={busy}
      >
        {intl.formatMessage(messages.logToday)}
      </button>

      <div className='klot-field klot-field--full'>
        <label className='klot-field__label' htmlFor='klot-lastdate'>
          {intl.formatMessage(messages.mostRecent)}
        </label>
        <input
          id='klot-lastdate'
          type='date'
          className='klot-field__input'
          value={mostRecent}
          onChange={handleDateChange}
        />
      </div>

      {toast && <p className='klot-card__toast'>{toast}</p>}

      <ul className='klot-log-list'>
        {periods.map((p, i) => {
          const d = new Date(`${p.started_on}T00:00:00`);
          const label = d.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          return (
            <li key={p.id} className='klot-log-list__item'>
              <span className='klot-log-list__dot' />
              <span className='klot-log-list__label'>{label}</span>
              {i === 0 && (
                <span className='klot-log-list__current'>· current</span>
              )}
              <button
                type='button'
                className='klot-log-list__remove'
                aria-label={intl.formatMessage(messages.removeLog)}
                onClick={async () => {
                  await onDelete(p.id);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
