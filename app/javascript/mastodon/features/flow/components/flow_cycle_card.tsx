import { useIntl, defineMessages } from 'react-intl';

import type { FlowCycle, CyclePhase } from '../types';

const messages = defineMessages({
  menstrual: { id: 'flow.phase.menstrual', defaultMessage: 'Menstrual' },
  follicular: { id: 'flow.phase.follicular', defaultMessage: 'Follicular' },
  ovulation: { id: 'flow.phase.ovulation', defaultMessage: 'Ovulation' },
  luteal: { id: 'flow.phase.luteal', defaultMessage: 'Luteal' },
  fertile: { id: 'flow.fertile_window', defaultMessage: 'Fertile window' },
  nextCycle: { id: 'flow.next_cycle', defaultMessage: 'Next cycle' },
  markEnded: { id: 'flow.mark_ended', defaultMessage: 'Mark period ended' },
  shareWith: { id: 'flow.share', defaultMessage: 'Share' },
  delete: { id: 'flow.delete', defaultMessage: 'Delete' },
  ovulationDay: { id: 'flow.ovulation_day', defaultMessage: 'Ovulation' },
});

const PHASE_LABELS: Record<CyclePhase, keyof typeof messages> = {
  menstrual: 'menstrual',
  follicular: 'follicular',
  ovulation: 'ovulation',
  luteal: 'luteal',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

interface Props {
  cycle: FlowCycle;
  onMarkEnded: (cycle: FlowCycle) => void;
  onShare: (cycle: FlowCycle) => void;
  onDelete: (cycle: FlowCycle) => void;
}

export const FlowCycleCard: React.FC<Props> = ({
  cycle,
  onMarkEnded,
  onShare,
  onDelete,
}) => {
  const intl = useIntl();

  return (
    <div className='flow-cycle-card'>
      <div className='flow-cycle-card__header'>
        <span className={`flow-cycle-card__phase flow-cycle-card__phase--${cycle.current_phase}`}>
          {intl.formatMessage(messages[PHASE_LABELS[cycle.current_phase]])}
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
              onClick={() => { onMarkEnded(cycle); }}
            >
              {intl.formatMessage(messages.markEnded)}
            </button>
          )}
          <button
            className='flow-cycle-card__action'
            onClick={() => { onShare(cycle); }}
          >
            {intl.formatMessage(messages.shareWith)}
          </button>
          <button
            className='flow-cycle-card__action flow-cycle-card__action--danger'
            onClick={() => { onDelete(cycle); }}
          >
            {intl.formatMessage(messages.delete)}
          </button>
        </div>
      )}
    </div>
  );
};
