import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

// A single row in Arrange mode. Owner-only. Displays name, source
// label, and the four controls the mock lays out:
//
//   ▲ / ▼  — move up / down
//   Visibility pill — cycles through the reach ladder
//   Order pill — drawn-only, cycles newest / oldest / chosen
//   Visible switch — on/off toggle
//
// Deletion is a small × on the right, hidden until hover to keep the
// row calm at rest.

const messages = defineMessages({
  moveUp: {
    id: 'profile_shelves.arrange.move_up',
    defaultMessage: 'Move up',
  },
  moveDown: {
    id: 'profile_shelves.arrange.move_down',
    defaultMessage: 'Move down',
  },
  remove: {
    id: 'profile_shelves.arrange.remove',
    defaultMessage: 'Remove',
  },
  reachEveryone: {
    id: 'profile_shelves.reach.everyone',
    defaultMessage: 'Everyone',
  },
  reachKronk: { id: 'profile_shelves.reach.kronk', defaultMessage: 'Kronk' },
  reachConnections: {
    id: 'profile_shelves.reach.connections',
    defaultMessage: 'Connections',
  },
  reachVouched: {
    id: 'profile_shelves.reach.vouched',
    defaultMessage: 'Vouched',
  },
  reachOnlyMe: {
    id: 'profile_shelves.reach.only_me',
    defaultMessage: 'Only me',
  },
  orderNewest: {
    id: 'profile_shelves.order.newest',
    defaultMessage: 'Newest',
  },
  orderOldest: {
    id: 'profile_shelves.order.oldest',
    defaultMessage: 'Oldest',
  },
  orderChosen: {
    id: 'profile_shelves.order.chosen',
    defaultMessage: 'Chosen',
  },
  written: {
    id: 'profile_shelves.arrange.written_by_you',
    defaultMessage: 'Written by you',
  },
  onLabel: {
    id: 'profile_shelves.arrange.on',
    defaultMessage: 'Show on profile',
  },
});

export const REACH_ORDER = [
  'everyone',
  'kronk',
  'connections',
  'vouched',
  'only_me',
] as const;

export type Reach = (typeof REACH_ORDER)[number];

export const ORDER_ORDER = ['newest', 'oldest', 'chosen'] as const;

export type OrderMode = (typeof ORDER_ORDER)[number];

const REACH_LABELS: Record<Reach, keyof typeof messages> = {
  everyone: 'reachEveryone',
  kronk: 'reachKronk',
  connections: 'reachConnections',
  vouched: 'reachVouched',
  only_me: 'reachOnlyMe',
};

const ORDER_LABELS: Record<OrderMode, keyof typeof messages> = {
  newest: 'orderNewest',
  oldest: 'orderOldest',
  chosen: 'orderChosen',
};

interface ArrangeSlabProps {
  slabKey: string;
  name: string;
  source: string | null; // null → told; string label → drawn
  visible: boolean;
  reach: Reach;
  order?: OrderMode; // drawn only
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
  onToggleVisible: (key: string) => void;
  onCycleReach: (key: string) => void;
  onCycleOrder?: (key: string) => void;
  onRemove: (key: string) => void;
}

export const ArrangeSlab: React.FC<ArrangeSlabProps> = ({
  slabKey,
  name,
  source,
  visible,
  reach,
  order,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onCycleReach,
  onCycleOrder,
  onRemove,
}) => {
  const intl = useIntl();

  const handleMoveUp = useCallback(() => {
    onMoveUp(slabKey);
  }, [onMoveUp, slabKey]);
  const handleMoveDown = useCallback(() => {
    onMoveDown(slabKey);
  }, [onMoveDown, slabKey]);
  const handleCycleOrder = useCallback(() => {
    onCycleOrder?.(slabKey);
  }, [onCycleOrder, slabKey]);
  const handleCycleReach = useCallback(() => {
    onCycleReach(slabKey);
  }, [onCycleReach, slabKey]);
  const handleToggleVisible = useCallback(() => {
    onToggleVisible(slabKey);
  }, [onToggleVisible, slabKey]);
  const handleRemove = useCallback(() => {
    onRemove(slabKey);
  }, [onRemove, slabKey]);

  return (
    <div
      className={`profile-shelves__slab${visible ? '' : ' profile-shelves__slab--off'}`}
    >
      <div className='profile-shelves__slab-grip'>
        <button
          type='button'
          className='profile-shelves__slab-grip-btn'
          onClick={handleMoveUp}
          disabled={!canMoveUp}
          aria-label={intl.formatMessage(messages.moveUp)}
        >
          ▲
        </button>
        <button
          type='button'
          className='profile-shelves__slab-grip-btn'
          onClick={handleMoveDown}
          disabled={!canMoveDown}
          aria-label={intl.formatMessage(messages.moveDown)}
        >
          ▼
        </button>
      </div>

      <div className='profile-shelves__slab-body'>
        <div className='profile-shelves__slab-name'>{name}</div>
        <div className='profile-shelves__slab-source'>
          {source ?? intl.formatMessage(messages.written)}
        </div>
      </div>

      <div className='profile-shelves__slab-ctl'>
        {order && onCycleOrder && (
          <button
            type='button'
            className='profile-shelves__slab-pill'
            onClick={handleCycleOrder}
          >
            {intl.formatMessage(messages[ORDER_LABELS[order]])}
          </button>
        )}
        <button
          type='button'
          className={`profile-shelves__slab-pill profile-shelves__slab-pill--reach profile-shelves__slab-pill--reach-${reach}`}
          onClick={handleCycleReach}
        >
          {intl.formatMessage(messages[REACH_LABELS[reach]])}
        </button>
        <button
          type='button'
          className='profile-shelves__slab-switch'
          aria-pressed={visible}
          onClick={handleToggleVisible}
          aria-label={intl.formatMessage(messages.onLabel)}
        />
        <button
          type='button'
          className='profile-shelves__slab-remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.remove)}
          title={intl.formatMessage(messages.remove)}
        >
          ×
        </button>
      </div>
    </div>
  );
};
