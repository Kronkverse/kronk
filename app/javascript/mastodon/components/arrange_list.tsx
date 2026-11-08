import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import ArrowDownIcon from '@/material-icons/400-24px/keyboard_arrow_down.svg?react';
import ArrowUpIcon from '@/material-icons/400-24px/keyboard_arrow_up.svg?react';
import { IconButton } from 'mastodon/components/icon_button';

// A list a person puts in order, one row per thing with Move up and Move
// down beside it: the order of a Krew's sections (Tal, 2026-11-08: "how
// can we arrange the order the spaces appear in? Perhaps the 'edit' page
// can have an arranging list"). Buttons rather than dragging, so it works
// the same with a thumb, a mouse or a keyboard. `onChange` gets the keys
// in their new order.

const messages = defineMessages({
  up: { id: 'arrange_list.up', defaultMessage: 'Move {name} up' },
  down: { id: 'arrange_list.down', defaultMessage: 'Move {name} down' },
});

export interface ArrangeItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

const Row: React.FC<{
  item: ArrangeItem;
  index: number;
  last: boolean;
  disabled?: boolean;
  onMove: (index: number, by: -1 | 1) => void;
}> = ({ item, index, last, disabled, onMove }) => {
  const intl = useIntl();
  const up = useCallback(() => {
    onMove(index, -1);
  }, [onMove, index]);
  const down = useCallback(() => {
    onMove(index, 1);
  }, [onMove, index]);

  return (
    <li className='arrange-list__row'>
      {item.icon && (
        <span className='arrange-list__icon' aria-hidden='true'>
          {item.icon}
        </span>
      )}
      <span className='arrange-list__label'>{item.label}</span>
      <IconButton
        className='arrange-list__move'
        icon='up'
        iconComponent={ArrowUpIcon}
        title={intl.formatMessage(messages.up, { name: item.label })}
        onClick={up}
        disabled={disabled || index === 0}
      />
      <IconButton
        className='arrange-list__move'
        icon='down'
        iconComponent={ArrowDownIcon}
        title={intl.formatMessage(messages.down, { name: item.label })}
        onClick={down}
        disabled={disabled || last}
      />
    </li>
  );
};

export const ArrangeList: React.FC<{
  items: ArrangeItem[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}> = ({ items, onChange, disabled }) => {
  const handleMove = useCallback(
    (index: number, by: -1 | 1) => {
      const keys = items.map((item) => item.key);
      const to = index + by;
      if (to < 0 || to >= keys.length) return;
      const [moved] = keys.splice(index, 1);
      if (moved === undefined) return;
      keys.splice(to, 0, moved);
      onChange(keys);
    },
    [items, onChange],
  );

  return (
    <ol className='arrange-list'>
      {items.map((item, index) => (
        <Row
          key={item.key}
          item={item}
          index={index}
          last={index === items.length - 1}
          disabled={disabled}
          onMove={handleMove}
        />
      ))}
    </ol>
  );
};
