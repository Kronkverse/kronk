import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiDeleteKlotLog,
  apiDeleteKlotViewer,
  apiGetKlotSelf,
  apiGetKlotViewers,
  apiPatchKlotSettings,
  apiPostKlotLog,
} from 'mastodon/api/klot';
import type { ApiKlotSelfJSON, ApiKlotViewerJSON } from 'mastodon/api/klot';

import { CycleRing } from './components/cycle_ring';
import { PHASES } from './phases';

const messages = defineMessages({
  yourLog: { id: 'klot.log.title', defaultMessage: 'Your log' },
  logLead: {
    id: 'klot.log.lead',
    defaultMessage:
      'Add a period whenever one starts. Your latest entry sets where you are now.',
  },
  logBtn: {
    id: 'klot.log.btn',
    defaultMessage: 'Log a period starting today',
  },
  logged: {
    id: 'klot.log.logged',
    defaultMessage: "Logged. You're on Day 1 — Menstrual.",
  },
  cycleLen: {
    id: 'klot.log.cycle_length',
    defaultMessage: 'Cycle length (days)',
  },
  periodLen: {
    id: 'klot.log.period_length',
    defaultMessage: 'Period length (days)',
  },
  sharedWith: {
    id: 'klot.shared.title',
    defaultMessage: 'Shared with',
  },
  sharedLead: {
    id: 'klot.shared.lead',
    defaultMessage:
      'Only these people can see where you are. They see a moon and a phase — never your dates, days, or notes.',
  },
  noViewers: {
    id: 'klot.shared.empty',
    defaultMessage: 'No one yet. Your cycle is yours.',
  },
  removeViewer: { id: 'klot.shared.remove', defaultMessage: 'Stop sharing' },
  addViewerHint: {
    id: 'klot.shared.add_hint',
    defaultMessage:
      "Add a viewer via their numeric account id (a picker lands with Phase 3 once we've wired the follow-list side).",
  },
  emptyPhase: {
    id: 'klot.mine.empty',
    defaultMessage: 'Log a period below to see your phase.',
  },
});

export const KlotMineView = () => {
  const intl = useIntl();
  const [self, setSelf] = useState<ApiKlotSelfJSON | null>(null);
  const [viewers, setViewers] = useState<ApiKlotViewerJSON[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [selfRes, viewersRes] = await Promise.all([
        apiGetKlotSelf(),
        apiGetKlotViewers(),
      ]);
      setSelf(selfRes);
      setViewers(viewersRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLog = useCallback(() => {
    void (async () => {
      try {
        const next = await apiPostKlotLog();
        setSelf(next);
        setToast(intl.formatMessage(messages.logged));
        window.setTimeout(() => {
          setToast(null);
        }, 3200);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [intl]);

  const handleDeleteLog = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    void (async () => {
      try {
        const next = await apiDeleteKlotLog(id);
        setSelf(next);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handleCycleChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const cycle = Math.max(
      15,
      Math.min(60, Number(e.currentTarget.value) || 28),
    );
    void (async () => {
      try {
        const next = await apiPatchKlotSettings({ cycle_length: cycle });
        setSelf(next);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handlePeriodChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const period = Math.max(
      1,
      Math.min(14, Number(e.currentTarget.value) || 5),
    );
    void (async () => {
      try {
        const next = await apiPatchKlotSettings({ period_length: period });
        setSelf(next);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const handleRemoveViewer = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const accountId = e.currentTarget.dataset.accountId;
    if (!accountId) return;
    void (async () => {
      try {
        await apiDeleteKlotViewer(accountId);
        setViewers((prev) => prev.filter((v) => v.account_id !== accountId));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  if (!self) {
    return (
      <p className='klot__loading'>
        {error ?? (
          <FormattedMessage id='klot.loading' defaultMessage='Loading…' />
        )}
      </p>
    );
  }

  const phaseKey = self.phase;
  const phaseCopy = phaseKey ? PHASES[phaseKey] : null;
  const accentStyle = phaseCopy
    ? ({ '--klot-accent': phaseCopy.colorVar } as React.CSSProperties)
    : undefined;

  return (
    <div className='klot-mine' style={accentStyle}>
      <div className='klot-mine__ringwrap'>
        <CycleRing
          cycleLength={self.cycle_length}
          periodLength={self.period_length}
          activePhase={phaseKey}
          currentDay={self.day_of_cycle}
        />
        <div className='klot-mine__ring-center'>
          {phaseCopy ? (
            <>
              <div className='klot-mine__c-phase'>{phaseCopy.name}</div>
              <div className='klot-mine__c-day'>
                <FormattedMessage
                  id='klot.mine.day_label'
                  defaultMessage='Day {day} · {cycle}-day cycle'
                  values={{ day: self.day_of_cycle, cycle: self.cycle_length }}
                />
              </div>
              <div className='klot-mine__c-tag'>{phaseCopy.tag}</div>
            </>
          ) : (
            <div className='klot-mine__c-empty'>
              <FormattedMessage {...messages.emptyPhase} />
            </div>
          )}
        </div>
      </div>

      {phaseCopy && (
        <section className='klot-card klot-card--phase'>
          <div className='klot-card__phase-head'>
            <span className='klot-card__phase-name'>{phaseCopy.name}</span>
            <span className='klot-card__phase-tag'>{phaseCopy.tag}</span>
          </div>
          <p className='klot-card__phase-body'>{phaseCopy.body}</p>
          {phaseCopy.note && (
            <p className='klot-card__phase-note'>{phaseCopy.note}</p>
          )}
        </section>
      )}

      <section className='klot-card'>
        <h2 className='klot-card__title'>
          <FormattedMessage {...messages.yourLog} />
        </h2>
        <p className='klot-card__lead'>
          <FormattedMessage {...messages.logLead} />
        </p>
        <button
          type='button'
          onClick={handleLog}
          className='klot-card__log-btn'
        >
          <FormattedMessage {...messages.logBtn} />
        </button>

        <div className='klot-card__fields'>
          <label className='klot-card__field'>
            <span className='klot-card__field-label'>
              <FormattedMessage {...messages.cycleLen} />
            </span>
            <input
              type='number'
              min={15}
              max={60}
              defaultValue={self.cycle_length}
              onBlur={handleCycleChange}
              className='klot-card__input'
            />
          </label>
          <label className='klot-card__field'>
            <span className='klot-card__field-label'>
              <FormattedMessage {...messages.periodLen} />
            </span>
            <input
              type='number'
              min={1}
              max={14}
              defaultValue={self.period_length}
              onBlur={handlePeriodChange}
              className='klot-card__input'
            />
          </label>
        </div>

        {toast && <div className='klot-card__toast'>{toast}</div>}

        <ul className='klot-card__logs'>
          {self.logs.map((log, idx) => (
            <li key={log.id} className='klot-card__log-row'>
              <span className='klot-card__log-dot' aria-hidden='true' />
              {new Date(`${log.started_on}T00:00:00`).toLocaleDateString(
                undefined,
                {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                },
              )}
              {idx === 0 && (
                <span className='klot-card__log-current'>
                  <FormattedMessage
                    id='klot.log.current'
                    defaultMessage='· current'
                  />
                </span>
              )}
              <button
                type='button'
                data-id={log.id}
                onClick={handleDeleteLog}
                aria-label='Remove log'
                className='klot-card__log-remove'
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className='klot-card'>
        <h2 className='klot-card__title'>
          <FormattedMessage {...messages.sharedWith} />
        </h2>
        <p className='klot-card__lead'>
          <FormattedMessage {...messages.sharedLead} />
        </p>

        {viewers.length === 0 ? (
          <div className='klot-card__empty'>
            <FormattedMessage {...messages.noViewers} />
          </div>
        ) : (
          <ul className='klot-card__viewers'>
            {viewers.map((v) => (
              <li key={v.account_id} className='klot-card__viewer'>
                <span
                  className='klot-card__viewer-avatar'
                  aria-hidden='true'
                  data-initial={v.name.charAt(0).toUpperCase()}
                >
                  {v.name.charAt(0).toUpperCase()}
                </span>
                <span className='klot-card__viewer-identity'>
                  <span className='klot-card__viewer-name'>{v.name}</span>
                  <span className='klot-card__viewer-handle'>@{v.handle}</span>
                </span>
                <button
                  type='button'
                  data-account-id={v.account_id}
                  onClick={handleRemoveViewer}
                  aria-label={intl.formatMessage(messages.removeViewer)}
                  className='klot-card__viewer-remove'
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className='klot-card__hint'>
          <FormattedMessage {...messages.addViewerHint} />
        </p>
      </section>

      {error && <p className='klot__error'>{error}</p>}
    </div>
  );
};
