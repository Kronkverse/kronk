import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, FormattedMessage } from 'react-intl';

import { apiGetKlotCircle } from 'mastodon/api/klot';
import type { ApiKlotCircleEntryJSON } from 'mastodon/api/klot';

import { CycleRing } from './components/cycle_ring';
import { CANON_LENGTH, CANON_PERIOD } from './geometry';
import { PHASES } from './phases';

const messages = defineMessages({
  hint: {
    id: 'klot.circle.hint',
    defaultMessage:
      'Everyone sharing with you, mapped by phase. Tap a name to read.',
  },
  sharingWithYou: {
    id: 'klot.circle.list_title',
    defaultMessage: 'Sharing with you',
  },
  listLead: {
    id: 'klot.circle.list_lead',
    defaultMessage:
      "These people chose to let you see their phase. You don't control this list — they do.",
  },
  empty: {
    id: 'klot.circle.empty',
    defaultMessage: 'No one is sharing with you yet.',
  },
  tapAMoon: {
    id: 'klot.circle.tap_a_moon',
    defaultMessage: 'Tap a moon',
  },
});

export const KlotCircleView = () => {
  const [circle, setCircle] = useState<ApiKlotCircleEntryJSON[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGetKlotCircle();
      setCircle(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0]?.account_id ?? null);
      }
      setLoaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setLoaded(true);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleListClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const id = e.currentTarget.dataset.accountId;
    if (id) setSelectedId(id);
  }, []);

  // Only include entries with a resolved phase — an owner with no logs
  // shows up here with phase=null, which we render in the list but
  // exclude from the ring layout.
  const friendMoons = useMemo(
    () =>
      circle
        .filter(
          (
            e,
          ): e is ApiKlotCircleEntryJSON & {
            phase: NonNullable<ApiKlotCircleEntryJSON['phase']>;
          } => e.phase !== null,
        )
        .map((e) => ({ id: e.account_id, name: e.name, phase: e.phase })),
    [circle],
  );

  const selected = circle.find((e) => e.account_id === selectedId) ?? null;
  const selectedCopy = selected?.phase ? PHASES[selected.phase] : null;
  const accentStyle = selectedCopy
    ? ({ '--klot-accent': selectedCopy.colorVar } as React.CSSProperties)
    : undefined;

  if (!loaded) {
    return (
      <p className='klot__loading'>
        <FormattedMessage id='klot.loading' defaultMessage='Loading…' />
      </p>
    );
  }

  return (
    <div className='klot-circle' style={accentStyle}>
      <div className='klot-mine__ringwrap'>
        <CycleRing
          cycleLength={CANON_LENGTH}
          periodLength={CANON_PERIOD}
          activePhase={selected?.phase ?? null}
          friends={friendMoons}
          selectedFriendId={selectedId}
          onSelectFriend={handleSelect}
        />
        <div className='klot-mine__ring-center'>
          {selected && selectedCopy ? (
            <>
              <div
                className='klot-mine__c-phase'
                style={{ color: 'var(--text-primary)' }}
              >
                {selected.name}
              </div>
              <div className='klot-mine__c-day'>
                <FormattedMessage
                  id='klot.circle.friend_phase_label'
                  defaultMessage='{moon} · {phase}'
                  values={{
                    moon: selectedCopy.moonName,
                    phase: selectedCopy.name,
                  }}
                />
              </div>
              <div className='klot-mine__c-tag'>@{selected.handle}</div>
            </>
          ) : (
            <div className='klot-mine__c-empty'>
              <FormattedMessage {...messages.tapAMoon} />
            </div>
          )}
        </div>
      </div>
      <p className='klot-mine__ring-hint'>
        <FormattedMessage {...messages.hint} />
      </p>

      {selected && selectedCopy && (
        <section className='klot-card klot-card--phase'>
          <div className='klot-card__phase-head'>
            <span className='klot-card__phase-name'>{selectedCopy.name}</span>
            <span className='klot-card__phase-tag'>{selectedCopy.tag}</span>
          </div>
          <p className='klot-card__phase-body'>{selectedCopy.body}</p>
          <p className='klot-card__phase-prompt'>{selectedCopy.checkin}</p>
        </section>
      )}

      <section className='klot-card'>
        <h2 className='klot-card__title'>
          <FormattedMessage {...messages.sharingWithYou} />
        </h2>
        <p className='klot-card__lead'>
          <FormattedMessage {...messages.listLead} />
        </p>
        {circle.length === 0 ? (
          <div className='klot-card__empty'>
            <FormattedMessage {...messages.empty} />
          </div>
        ) : (
          <ul className='klot-card__viewers'>
            {circle.map((entry) => {
              const copy = entry.phase ? PHASES[entry.phase] : null;
              return (
                <li key={entry.account_id}>
                  <button
                    type='button'
                    data-account-id={entry.account_id}
                    onClick={handleListClick}
                    className={`klot-card__viewer klot-card__viewer--clickable ${entry.account_id === selectedId ? 'klot-card__viewer--selected' : ''}`}
                  >
                    <span
                      className='klot-card__viewer-avatar'
                      aria-hidden='true'
                      data-initial={entry.name.charAt(0).toUpperCase()}
                    >
                      {entry.name.charAt(0).toUpperCase()}
                    </span>
                    <span className='klot-card__viewer-identity'>
                      <span className='klot-card__viewer-name'>
                        {entry.name}
                      </span>
                      <span className='klot-card__viewer-handle'>
                        @{entry.handle}
                      </span>
                    </span>
                    {copy && (
                      <span
                        className='klot-card__viewer-phase'
                        style={{ color: copy.colorVar }}
                      >
                        {copy.name}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && <p className='klot__error'>{error}</p>}
    </div>
  );
};
