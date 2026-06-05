import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import FavoriteIcon from '@/material-icons/400-24px/favorite.svg?react';
import api from 'mastodon/api';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { spaceColor } from 'mastodon/planets';

import { FlowCycleCard } from './components/flow_cycle_card';
import type { FlowCycle } from './types';

const messages = defineMessages({
  heading: { id: 'flow.title', defaultMessage: 'Flow' },
  loading: { id: 'flow.loading', defaultMessage: 'Loading…' },
  empty: { id: 'flow.empty', defaultMessage: 'No cycles logged yet.' },
  logCycle: { id: 'flow.log_cycle', defaultMessage: 'Log cycle start' },
  sharedWithMe: { id: 'flow.shared_with_me', defaultMessage: 'Shared with me' },
  myCycles: { id: 'flow.my_cycles', defaultMessage: 'My cycles' },
  notesPlaceholder: { id: 'flow.notes_placeholder', defaultMessage: 'Notes (optional)' },
  cycleLengthPlaceholder: { id: 'flow.cycle_length_placeholder', defaultMessage: 'Avg. cycle length in days (default 28)' },
  cancel: { id: 'flow.cancel', defaultMessage: 'Cancel' },
  save: { id: 'flow.save', defaultMessage: 'Save' },
  confirmDelete: { id: 'flow.confirm_delete', defaultMessage: 'Delete this cycle entry?' },
  shareAccountId: { id: 'flow.share_account_id', defaultMessage: 'Account ID to share with' },
});

const Flow: React.FC<{ multiColumn: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);

  const [cycles, setCycles] = useState<FlowCycle[]>([]);
  const [sharedCycles, setSharedCycles] = useState<FlowCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');

  const [formNotes, setFormNotes] = useState('');
  const [formCycleLength, setFormCycleLength] = useState('');

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  const loadCycles = useCallback(() => {
    setLoading(true);
    void api()
      .get<FlowCycle[]>('/api/v1/flow_cycles')
      .then((res) => {
        setCycles(res.data);
      })
      .finally(() => {
        setLoading(false);
      });

    void api()
      .get<FlowCycle[]>('/api/v1/flow_cycles/shared_with_me')
      .then((res) => {
        setSharedCycles(res.data);
      });
  }, []);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const handleLogCycle = useCallback(() => {
    void api()
      .post<FlowCycle>('/api/v1/flow_cycles', {
        started_on: new Date().toISOString().split('T')[0],
        notes: formNotes || null,
        cycle_length: formCycleLength ? parseInt(formCycleLength, 10) : null,
      })
      .then((res) => {
        setCycles((prev) => [res.data, ...prev]);
        setShowForm(false);
        setFormNotes('');
        setFormCycleLength('');
      });
  }, [formNotes, formCycleLength]);

  const handleMarkEnded = useCallback((cycle: FlowCycle) => {
    void api()
      .put<FlowCycle>(`/api/v1/flow_cycles/${cycle.id}`, {
        ended_on: new Date().toISOString().split('T')[0],
      })
      .then((res) => {
        setCycles((prev) => prev.map((c) => (c.id === cycle.id ? res.data : c)));
      });
  }, []);

  const handleShare = useCallback((cycle: FlowCycle) => {
    const accountId = window.prompt(intl.formatMessage(messages.shareAccountId));
    if (!accountId) return;

    void api().post(`/api/v1/flow_cycles/${cycle.id}/share`, {
      account_id: accountId,
    });
  }, [intl]);

  const handleDelete = useCallback((cycle: FlowCycle) => {
    if (!window.confirm(intl.formatMessage(messages.confirmDelete))) return;

    void api()
      .delete(`/api/v1/flow_cycles/${cycle.id}`)
      .then(() => {
        setCycles((prev) => prev.filter((c) => c.id !== cycle.id));
      });
  }, [intl]);

  const displayedCycles = tab === 'mine' ? cycles : sharedCycles;

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        icon='favorite'
        iconComponent={FavoriteIcon}
        title={intl.formatMessage(messages.heading)}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div
        className='flow-space'
        style={{ '--space-color': spaceColor('Flow') } as React.CSSProperties}
      >
        <div className='flow-space__tabs'>
          <button
            className={`flow-space__tab${tab === 'mine' ? ' flow-space__tab--active' : ''}`}
            onClick={() => { setTab('mine'); }}
          >
            {intl.formatMessage(messages.myCycles)}
          </button>
          <button
            className={`flow-space__tab${tab === 'shared' ? ' flow-space__tab--active' : ''}`}
            onClick={() => { setTab('shared'); }}
          >
            {intl.formatMessage(messages.sharedWithMe)}
          </button>
        </div>

        {tab === 'mine' && (
          <div className='flow-space__actions'>
            {showForm ? (
              <div className='flow-space__log-form'>
                <input
                  type='number'
                  className='flow-space__input'
                  placeholder={intl.formatMessage(messages.cycleLengthPlaceholder)}
                  value={formCycleLength}
                  onChange={(e) => { setFormCycleLength(e.target.value); }}
                  min={1}
                  max={99}
                />
                <textarea
                  className='flow-space__input flow-space__input--textarea'
                  placeholder={intl.formatMessage(messages.notesPlaceholder)}
                  value={formNotes}
                  onChange={(e) => { setFormNotes(e.target.value); }}
                  rows={3}
                />
                <div className='flow-space__form-buttons'>
                  <button className='flow-space__btn flow-space__btn--secondary' onClick={() => { setShowForm(false); }}>
                    {intl.formatMessage(messages.cancel)}
                  </button>
                  <button className='flow-space__btn flow-space__btn--primary' onClick={handleLogCycle}>
                    {intl.formatMessage(messages.save)}
                  </button>
                </div>
              </div>
            ) : (
              <button className='flow-space__btn flow-space__btn--primary' onClick={() => { setShowForm(true); }}>
                {intl.formatMessage(messages.logCycle)}
              </button>
            )}
          </div>
        )}

        <div className='flow-space__list'>
          {loading && <p className='flow-space__empty'>{intl.formatMessage(messages.loading)}</p>}
          {!loading && displayedCycles.length === 0 && (
            <p className='flow-space__empty'>{intl.formatMessage(messages.empty)}</p>
          )}
          {displayedCycles.map((cycle) => (
            <FlowCycleCard
              key={cycle.id}
              cycle={cycle}
              onMarkEnded={handleMarkEnded}
              onShare={handleShare}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
      </Helmet>
    </Column>
  );
};

export default Flow;
