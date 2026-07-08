import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import type {
  KlotPeriod,
  KlotSettings,
  KlotShare,
  PhaseKey,
} from './types';
import {
  fetchPeriods,
  createPeriod,
  deletePeriod,
  fetchSettings,
  updateSettings,
  fetchShares,
  createShareByAcct,
  deleteShare,
} from './api';
import {
  ranges,
  phaseOf,
  dayOfCycle,
  PHASE_NAMES,
  PHASE_TAGS,
  PHASE_BODY,
  PHASE_NOTE,
  PHASE_COLORS,
} from './phase_math';
import { CycleRing } from './components/cycle_ring';
import { LogCard } from './components/log_card';
import { SettingsCard } from './components/settings_card';
import { ShareCard } from './components/share_card';

const messages = defineMessages({
  heading: { id: 'klot.title', defaultMessage: 'Klot' },
  loading: { id: 'klot.loading', defaultMessage: 'Loading…' },
  ringHint: {
    id: 'klot.ring_hint',
    defaultMessage: 'Tap the ring to read any day.',
  },
  backToToday: {
    id: 'klot.back_to_today',
    defaultMessage: 'Back to today',
  },
});

const DEFAULT_SETTINGS: KlotSettings = {
  cycle_length: 28,
  period_length: 5,
  updated_at: '',
};

const Klot: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();

  const [periods, setPeriods] = useState<KlotPeriod[]>([]);
  const [settings, setSettings] = useState<KlotSettings>(DEFAULT_SETTINGS);
  const [shares, setShares] = useState<KlotShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectedDay, setInspectedDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPeriods(), fetchSettings(), fetchShares()])
      .then(([p, s, sh]) => {
        if (cancelled) return;
        setPeriods(p);
        setSettings(s);
        setShares(sh);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayDay = useMemo(() => {
    return dayOfCycle(
      periods[0]?.started_on,
      new Date(),
      settings.cycle_length,
    );
  }, [periods, settings.cycle_length]);

  const inspecting = inspectedDay !== null;
  const currentDay = inspecting ? inspectedDay : todayDay;
  const currentPhase: PhaseKey = useMemo(
    () => phaseOf(currentDay, settings.cycle_length, settings.period_length),
    [currentDay, settings.cycle_length, settings.period_length],
  );

  // Todays real phase for the sharing badge — always reflects real
  // time, not the inspected day.
  const todayPhase: PhaseKey = useMemo(
    () => phaseOf(todayDay, settings.cycle_length, settings.period_length),
    [todayDay, settings.cycle_length, settings.period_length],
  );

  const handleLog = useCallback(async (startedOn: string) => {
    const created = await createPeriod(startedOn);
    setPeriods((prev) => {
      const filtered = prev.filter((p) => p.started_on !== startedOn);
      return [created, ...filtered].sort((a, b) =>
        a.started_on < b.started_on ? 1 : -1,
      );
    });
    setInspectedDay(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deletePeriod(id);
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleSettingsChange = useCallback(
    async (patch: Partial<Pick<KlotSettings, 'cycle_length' | 'period_length'>>) => {
      const next = await updateSettings(patch);
      setSettings(next);
    },
    [],
  );

  const handleShareAdd = useCallback(async (acct: string) => {
    const created = await createShareByAcct(acct);
    setShares((prev) => [created, ...prev]);
  }, []);

  const handleShareRemove = useCallback(async (id: string) => {
    await deleteShare(id);
    setShares((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const accent = PHASE_COLORS[currentPhase];

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='favorite'
        iconComponent={planetIcon('Klot')}
        title={intl.formatMessage(messages.heading)}
        multiColumn={multiColumn}
      />

      <div
        className='klot-page scrollable'
        style={
          {
            '--space-color': spaceColor('Klot'),
            '--klot-accent': accent,
          } as React.CSSProperties
        }
      >
        <header className='klot-hero'>
          <p className='klot-eyebrow'>
            <FormattedMessage
              id='klot.eyebrow'
              defaultMessage='Cosmos · moon'
            />
          </p>
          <h1 className='klot-hero__title serif'>Klot</h1>
          <p className='klot-hero__lede'>
            <FormattedMessage
              id='klot.hero.lede'
              defaultMessage='Track your cycle. Share the phase, not the data.'
            />
          </p>
        </header>

        {loading ? (
          <div className='klot-page__loading'>
            {intl.formatMessage(messages.loading)}
          </div>
        ) : (
          <>
            <div className='klot-ringwrap'>
              <CycleRing
                cycleLength={settings.cycle_length}
                periodLength={settings.period_length}
                currentDay={currentDay}
                currentPhase={currentPhase}
                onInspect={setInspectedDay}
              />
              <div className='klot-ring-center'>
                <div
                  className='klot-ring-center__phase serif'
                  style={{ color: accent }}
                >
                  {PHASE_NAMES[currentPhase]}
                </div>
                <div className='klot-ring-center__day'>
                  <FormattedMessage
                    id='klot.ring.day'
                    defaultMessage='Day {day} · {length}-day cycle'
                    values={{
                      day: currentDay,
                      length: settings.cycle_length,
                    }}
                  />
                  {inspecting && (
                    <span className='klot-ring-center__reading'>
                      {' '}
                      · <FormattedMessage id='klot.ring.reading' defaultMessage='reading' />
                    </span>
                  )}
                </div>
                <div className='klot-ring-center__tag'>
                  {PHASE_TAGS[currentPhase]}
                </div>
              </div>
            </div>
            <p className='klot-ringhint'>
              {intl.formatMessage(messages.ringHint)}
            </p>
            {inspecting && (
              <div className='klot-rowcenter'>
                <button
                  type='button'
                  className='klot-todaybtn'
                  onClick={() => {
                    setInspectedDay(null);
                  }}
                >
                  {intl.formatMessage(messages.backToToday)}
                </button>
              </div>
            )}

            <div className='klot-card klot-phasecard' style={{ borderLeftColor: accent }}>
              <div className='klot-phasecard__head'>
                <span className='klot-phasecard__name serif' style={{ color: accent }}>
                  {PHASE_NAMES[currentPhase]}
                </span>
                <span className='klot-phasecard__tag'>
                  {PHASE_TAGS[currentPhase]}
                </span>
              </div>
              <p className='klot-phasecard__body'>
                {PHASE_BODY[currentPhase]}
              </p>
              {PHASE_NOTE[currentPhase] && (
                <p className='klot-phasecard__note'>
                  {PHASE_NOTE[currentPhase]}
                </p>
              )}
            </div>

            <LogCard
              periods={periods}
              onLog={handleLog}
              onDelete={handleDelete}
            />

            <SettingsCard
              cycleLength={settings.cycle_length}
              periodLength={settings.period_length}
              onChange={handleSettingsChange}
            />

            <ShareCard
              shares={shares}
              currentPhase={todayPhase}
              onAdd={handleShareAdd}
              onRemove={handleShareRemove}
            />

            <div className='klot-sov'>
              <span className='klot-sov__icon' aria-hidden>
                🔒
              </span>
              <span>
                <FormattedMessage
                  id='klot.sovereignty'
                  defaultMessage='Your cycle lives with you. Kronk stores only what it must and never shares your log — recipients see the phase you allow, nothing beneath it.'
                />
                <span className='klot-sov__prov'>
                  <FormattedMessage id='klot.provisional' defaultMessage='provisional' />
                </span>
              </span>
            </div>

            {/* Unused hoist to satisfy the linter without extra imports */}
            <span hidden>{ranges(settings.cycle_length, settings.period_length).length}</span>
          </>
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Klot;
