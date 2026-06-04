import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { CyclePhase, FlowCycle } from '../types';

const messages = defineMessages({
  delete: { id: 'flow.delete', defaultMessage: 'Delete' },
  fertile: { id: 'flow.fertile_window', defaultMessage: 'Fertile window' },
  follicular: { id: 'flow.phase.follicular', defaultMessage: 'Follicular' },
  luteal: { id: 'flow.phase.luteal', defaultMessage: 'Luteal' },
  markEnded: { id: 'flow.mark_ended', defaultMessage: 'Mark period ended' },
  menstrual: { id: 'flow.phase.menstrual', defaultMessage: 'Menstrual' },
  nextCycle: { id: 'flow.next_cycle', defaultMessage: 'Next cycle' },
  ovulation: { id: 'flow.phase.ovulation', defaultMessage: 'Ovulation' },
  ovulationDay: { id: 'flow.ovulation_day', defaultMessage: 'Ovulation' },
  shareWith: { id: 'flow.share', defaultMessage: 'Share' },
});

const PHASE_MESSAGES: Record<CyclePhase, keyof typeof messages> = {
  follicular: 'follicular',
  luteal: 'luteal',
  menstrual: 'menstrual',
  ovulation: 'ovulation',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

interface Props {
  cycle: FlowCycle;
  onDelete: (cycle: FlowCycle) => void;
  onMarkEnded: (cycle: FlowCycle) => void;
  onShare: (cycle: FlowCycle) => void;
}

export const FlowCycleCard: React.FC<Props> = ({
  cycle,
  onDelete,
  onMarkEnded,
  onShare,
}) => {
  const intl = useIntl();

  const handleMarkEnded = useCallback(() => {
    onMarkEnded(cycle);
  }, [onMarkEnded, cycle]);

  const handleShare = useCallback(() => {
    onShare(cycle);
  }, [onShare, cycle]);

  const handleDelete = useCallback(() => {
    onDelete(cycle);
  }, [onDelete, cycle]);

  return (
    <div className='flow-cycle-card'>
      <div className='flow-cycle-card__header'>
        <span className={`flow-cycle-card__phase flow-cycle-card__phase--${cycle.current_phase}`}>
          {intl.formatMessage(messages[PHASE_MESSAGES[cycle.current_phase]])}
        </span>
        <span className='flow-cycle-card__dates'>
          {formatDate(cycle.started_on)}
          {cycle.ended_on ? ` – ${formatDate(cycle.ended_on)}` : ' →'}
        </span>
      </div>

      <div className='flow-cycle-card__body'>
        <div className='flow-cycle-card__stat'>
          <span className='flow-cycle-card__stat-label'>
            {intl.formatMessage(messages.fertile)}
          </span>
          <span className='flow-cycle-card__stat-value'>
            {formatDate(cycle.fertile_window_start)} – {formatDate(cycle.fertile_window_end)}
          </span>
        </div>

        <div className='flow-cycle-card__stat'>
          <span className='flow-cycle-card__stat-label'>
            {intl.formatMessage(messages.ovulationDay)}
          </span>
          <span className='flow-cycle-card__stat-value'>
            {formatDate(cycle.ovulation_day)}
          </span>
        </div>

        <div className='flow-cycle-card__stat'>
          <span className='flow-cycle-card__stat-label'>
            {intl.formatMessage(messages.nextCycle)}
          </span>
          <span className='flow-cycle-card__stat-value'>
            {formatDate(cycle.predicted_next_start)}
          </span>
        </div>
      </div>

      {cycle.notes && (
        <p className='flow-cycle-card__notes'>{cycle.notes}</p>
      )}

      {cycle.is_owner && (
        <div className='flow-cycle-card__actions'>
          {!cycle.ended_on && (
            <button
              className='flow-cycle-card__action'
              onClick={handleMarkEnded}
            >
              {intl.formatMessage(messages.markEnded)}
            </button>
          )}
          <button
            className='flow-cycle-card__action'
            onClick={handleShare}
          >
            {intl.formatMessage(messages.shareWith)}
          </button>
          <button
            className='flow-cycle-card__action flow-cycle-card__action--danger'
            onClick={handleDelete}
          >
            {intl.formatMessage(messages.delete)}
          </button>
        </div>
      )}
    </div>
  );
};
