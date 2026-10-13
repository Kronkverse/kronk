import { Fragment, useCallback } from 'react';

import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A run of profile items that Arrange can reorder by dragging: the facts in
// the stat line, the chip rows, the paragraphs, the links, the Kuestion
// tiles. Outside Arrange it renders the items exactly as they are, so the
// page a visitor sees is the page you arrange.
//
// Each item renders its own element and is handed the drag wiring to spread
// on it, rather than being wrapped: a wrapper would break the layouts that
// depend on items being siblings (the drawn `·` between facts is a
// `fact + fact` rule).

// Hold-to-lift on touch, a short drag with a mouse: the same feel as the
// tiles on the board.
const HOLD_MS = 300;
const HOLD_TOLERANCE_PX = 8;

export interface SortableBind {
  ref: (element: HTMLElement | null) => void;
  style: React.CSSProperties;
  lifted: boolean;
  // dnd-kit's attributes and listeners, to spread on the item's element.
  handlers: Record<string, unknown>;
}

export interface ArrangeItem {
  id: string;
  // Called with no bind outside Arrange.
  render: (bind?: SortableBind) => React.ReactNode;
}

const SortableSlot: React.FC<{ item: ArrangeItem }> = ({ item }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <>
      {item.render({
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        lifted: isDragging,
        handlers: { ...attributes, ...listeners },
      })}
    </>
  );
};

interface Props {
  items: ArrangeItem[];
  arrange: boolean;
  // The ids of this run in their new order.
  onReorder?: (ids: string[]) => void;
  className: string;
  as?: 'div' | 'span';
}

export const ArrangeGroup: React.FC<Props> = ({
  items,
  arrange,
  onReorder,
  className,
  as: Tag = 'div',
}) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: HOLD_MS, tolerance: HOLD_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = items.map((item) => item.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;

      const [moved] = ids.splice(from, 1);
      if (!moved) return;
      ids.splice(to, 0, moved);
      onReorder?.(ids);
    },
    [items, onReorder],
  );

  if (items.length === 0) return null;

  if (!arrange) {
    return (
      <Tag className={className}>
        {items.map((item) => (
          <Fragment key={item.id}>{item.render()}</Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <Tag className={`${className} arrange-group`}>
          {items.map((item) => (
            <SortableSlot key={item.id} item={item} />
          ))}
        </Tag>
      </SortableContext>
    </DndContext>
  );
};
