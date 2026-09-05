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
  reachSelf: { id: 'profile_shelves.reach.self_only', defaultMessage: 'Me' },
  reachMates: { id: 'profile_shelves.reach.mates', defaultMessage: 'Mates' },
  reachOrbit: { id: 'profile_shelves.reach.orbit', defaultMessage: 'Orbit' },
  reachPublic: {
    id: 'profile_shelves.reach.public',
    defaultMessage: 'Kronkverse',
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
  sizeAuto: {
    id: 'profile_arrange.size_auto',
    defaultMessage: 'Size: auto',
  },
  sizeSmall: { id: 'profile_arrange.size_small', defaultMessage: 'Size: S' },
  sizeMedium: { id: 'profile_arrange.size_medium', defaultMessage: 'Size: M' },
  sizeLarge: { id: 'profile_arrange.size_large', defaultMessage: 'Size: L' },
  sizeFeature: {
    id: 'profile_arrange.size_feature',
    defaultMessage: 'Size: feature',
  },
  sizeHint: {
    id: 'profile_arrange.size_hint',
    defaultMessage: 'How much room this takes on your profile',
  },
});

export const REACH_ORDER = ['self_only', 'mates', 'orbit', 'public'] as const;

export type Reach = (typeof REACH_ORDER)[number];

export const ORDER_ORDER = ['newest', 'oldest', 'chosen'] as const;

// Tile sizes on the profile board, smallest first. The cycle offers only the
// sizes a given tile can honour — see `tileSizeFloor` in `profile_board.tsx`.
export const SIZE_ORDER = ['s', 'm', 'l', 'xl'] as const;

export type OrderMode = (typeof ORDER_ORDER)[number];

const REACH_LABELS: Record<Reach, keyof typeof messages> = {
  self_only: 'reachSelf',
  mates: 'reachMates',
  orbit: 'reachOrbit',
  public: 'reachPublic',
};

const SIZE_LABELS: Record<
  's' | 'm' | 'l' | 'xl' | 'auto',
  keyof typeof messages
> = {
  auto: 'sizeAuto',
  s: 'sizeSmall',
  m: 'sizeMedium',
  l: 'sizeLarge',
  xl: 'sizeFeature',
};

const ORDER_LABELS: Record<OrderMode, keyof typeof messages> = {
  newest: 'orderNewest',
  oldest: 'orderOldest',
  chosen: 'orderChosen',
};

interface ArrangeSlabProps {
  slabKey: string;
  family: 'told' | 'drawn';
  name: string;
  source: string | null; // null → told; string label → drawn
  visible: boolean;
  reach: Reach;
  order?: OrderMode; // drawn only
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDragging?: boolean;
  isDragTarget?: 'above' | 'below' | null;
  onMoveUp: (key: string) => void;
  onMoveDown: (key: string) => void;
  onToggleVisible: (key: string) => void;
  onCycleReach: (key: string) => void;
  onCycleOrder?: (key: string) => void;
  // The stored size, or null when the tile still uses the size the board
  // derives from its content. The pill shows the effective size either way.
  size?: 's' | 'm' | 'l' | 'xl' | null;
  onCycleSize?: (key: string) => void;
  onRemove: (key: string) => void;
  onEdit?: (key: string) => void;
  onDragStart?: (key: string, family: 'told' | 'drawn') => void;
  onDragOver?: (
    key: string,
    family: 'told' | 'drawn',
    pos: 'above' | 'below',
  ) => void;
  onDragEnd?: () => void;
  onDrop?: (key: string, family: 'told' | 'drawn') => void;
}

export const ArrangeSlab: React.FC<ArrangeSlabProps> = ({
  slabKey,
  family,
  name,
  source,
  visible,
  reach,
  order,
  canMoveUp,
  canMoveDown,
  isDragging,
  isDragTarget,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onCycleReach,
  onCycleOrder,
  size,
  onCycleSize,
  onRemove,
  onEdit,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
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

  const handleCycleSize = useCallback(() => {
    onCycleSize?.(slabKey);
  }, [onCycleSize, slabKey]);
  const handleCycleReach = useCallback(() => {
    onCycleReach(slabKey);
  }, [onCycleReach, slabKey]);
  const handleToggleVisible = useCallback(() => {
    onToggleVisible(slabKey);
  }, [onToggleVisible, slabKey]);
  const handleRemove = useCallback(() => {
    onRemove(slabKey);
  }, [onRemove, slabKey]);
  const handleEdit = useCallback(() => {
    onEdit?.(slabKey);
  }, [onEdit, slabKey]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!onDragStart) return;
      // Empty text/plain payload keeps the browser from painting a
      // "no-drop" cursor over the target area.
      e.dataTransfer.setData('text/plain', slabKey);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(slabKey, family);
    },
    [family, onDragStart, slabKey],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onDragOver) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
      onDragOver(slabKey, family, pos);
    },
    [family, onDragOver, slabKey],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!onDrop) return;
      e.preventDefault();
      onDrop(slabKey, family);
    },
    [family, onDrop, slabKey],
  );

  const slabClass = [
    'profile-shelves__slab',
    visible ? '' : 'profile-shelves__slab--off',
    isDragging ? 'profile-shelves__slab--dragging' : '',
    isDragTarget === 'above' ? 'profile-shelves__slab--drop-above' : '',
    isDragTarget === 'below' ? 'profile-shelves__slab--drop-below' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={slabClass}
      draggable={onDragStart !== undefined}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      <div className='profile-shelves__slab-grip'>
        <span
          className='profile-shelves__slab-grip-handle'
          aria-hidden='true'
          title='Drag to reorder'
        >
          ⋮⋮
        </span>
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

      {onEdit ? (
        <button
          type='button'
          className='profile-shelves__slab-body profile-shelves__slab-body--edit'
          onClick={handleEdit}
        >
          <div className='profile-shelves__slab-name'>{name}</div>
          <div className='profile-shelves__slab-source'>
            {source ?? intl.formatMessage(messages.written)}
          </div>
        </button>
      ) : (
        <div className='profile-shelves__slab-body'>
          <div className='profile-shelves__slab-name'>{name}</div>
          <div className='profile-shelves__slab-source'>
            {source ?? intl.formatMessage(messages.written)}
          </div>
        </div>
      )}

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
        {onCycleSize && (
          <button
            type='button'
            className='profile-shelves__slab-pill profile-shelves__slab-pill--size'
            onClick={handleCycleSize}
            title={intl.formatMessage(messages.sizeHint)}
          >
            {intl.formatMessage(messages[SIZE_LABELS[size ?? 'auto']])}
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
