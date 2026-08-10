import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import ExpandMoreIcon from '@/material-icons/400-24px/expand_more.svg?react';
import { Icon } from 'mastodon/components/icon';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

import type { SpaceView } from './space_view_picker';

// SpaceViewMenu — the compact dropdown alternate to <SpaceViewPicker>
// for korners whose views aren't reach-filters over the same
// material but genuinely separate workflows (Kommons: Feed / Backing
// / Tasks / Budget; Martketplace: four boards; Map: three surfaces).
//
// The pill-row picker breaks past three or four faces — the row
// wraps or scrolls, and every option is loud when only one is
// current. The dropdown reserves the room of one button: the trigger
// shows the current face, tapping opens the list. Manifest-driven
// via `header.picker: 'menu'`; without opt-in a korner keeps the
// existing pill row.
//
// Not to be confused with `<ScopeTitle>` — that's for the rotator
// pattern (title IS the switcher). This is the third pattern:
// title stays static, switcher lives in the header row's right slot
// as a menu.

const messages = defineMessages({
  aria: {
    id: 'space_view_menu.aria',
    defaultMessage: 'Change view',
  },
  current: {
    id: 'space_view_menu.current',
    defaultMessage: 'Currently {view}',
  },
});

interface Props {
  views: SpaceView[];
  current: string;
  onChange: (key: string) => void;
}

export const SpaceViewMenu: React.FC<Props> = ({
  views,
  current,
  onChange,
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentIndex = views.findIndex((v) => v.key === current);
  const currentView = views[currentIndex >= 0 ? currentIndex : 0];

  // Close on outside click + Escape. Escape returns focus to the
  // trigger so keyboard users don't lose their place.
  useEffect(() => {
    if (!open) return;

    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Focus the current item on open so keyboard users land on
  // something obvious.
  useEffect(() => {
    if (!open) return;
    const idx = currentIndex >= 0 ? currentIndex : 0;
    itemRefs.current[idx]?.focus();
  }, [open, currentIndex]);

  const handleToggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);

  const handleSelect = useCallback(
    (key: string) => {
      setOpen(false);
      triggerRef.current?.focus();
      if (key !== current) onChange(key);
    },
    [current, onChange],
  );

  // Arrow-key navigation between items; roving focus.
  const handleItemKey = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next = (index + delta + views.length) % views.length;
        itemRefs.current[next]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        itemRefs.current[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        itemRefs.current[views.length - 1]?.focus();
      }
    },
    [views.length],
  );

  const setItemRef = useCallback(
    (index: number) => (node: HTMLButtonElement | null) => {
      itemRefs.current[index] = node;
    },
    [],
  );

  if (!currentView) return null;

  const triggerIconComponent = currentView.icon
    ? kornerIcon(currentView.key, { icon: { material: currentView.icon } })
    : null;

  return (
    <div className='space-view-menu'>
      <button
        ref={triggerRef}
        type='button'
        className='space-view-menu__trigger'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-label={intl.formatMessage(messages.aria)}
        title={intl.formatMessage(messages.current, {
          view: currentView.label,
        })}
        onClick={handleToggle}
      >
        {triggerIconComponent && (
          <Icon
            id={currentView.icon ?? currentView.key}
            icon={triggerIconComponent}
            className='space-view-menu__trigger-icon'
          />
        )}
        <span className='space-view-menu__trigger-label'>
          {currentView.label}
        </span>
        <Icon
          id='expand-more'
          icon={ExpandMoreIcon}
          className='space-view-menu__trigger-caret'
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          className='space-view-menu__list'
          role='menu'
          aria-label={intl.formatMessage(messages.aria)}
        >
          {views.map((view, i) => {
            const isCurrent = view.key === current;
            const itemIcon = view.icon
              ? kornerIcon(view.key, { icon: { material: view.icon } })
              : null;
            return (
              <SpaceViewMenuItem
                key={view.key}
                index={i}
                view={view}
                iconComponent={itemIcon}
                isCurrent={isCurrent}
                onSelect={handleSelect}
                onKeyDown={handleItemKey(i)}
                setRef={setItemRef(i)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ItemProps {
  index: number;
  view: SpaceView;
  iconComponent: ReturnType<typeof kornerIcon> | null;
  isCurrent: boolean;
  onSelect: (key: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  setRef: (node: HTMLButtonElement | null) => void;
}

// Row component so the click handler can useCallback-bind the view
// key without an inline arrow (react/jsx-no-bind).
const SpaceViewMenuItem: React.FC<ItemProps> = ({
  view,
  iconComponent,
  isCurrent,
  onSelect,
  onKeyDown,
  setRef,
}) => {
  const handleClick = useCallback(() => {
    onSelect(view.key);
  }, [onSelect, view.key]);

  return (
    <button
      ref={setRef}
      type='button'
      role='menuitemradio'
      aria-checked={isCurrent}
      className={`space-view-menu__item${isCurrent ? ' space-view-menu__item--current' : ''}`}
      onClick={handleClick}
      onKeyDown={onKeyDown}
    >
      {iconComponent && (
        <Icon
          id={view.icon ?? view.key}
          icon={iconComponent}
          className='space-view-menu__item-icon'
        />
      )}
      <span className='space-view-menu__item-label'>{view.label}</span>
      {isCurrent && (
        <Icon
          id='check'
          icon={CheckIcon}
          className='space-view-menu__item-check'
        />
      )}
    </button>
  );
};
