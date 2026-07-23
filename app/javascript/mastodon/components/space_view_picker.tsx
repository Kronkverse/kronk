import { useCallback, useEffect, useRef, useState } from 'react';

// SpaceViewPicker — the per-space view selector. Only the current view
// is visible as a pill (e.g. "Today ▾"). Tap opens a dropdown of the
// other views. Selecting one closes the dropdown and swaps the trigger
// label. Click-outside and Escape also close.
//
// Prototype: docs/kronk_frame_prototype_v11.html.
// Spec: docs/kronk_frame.md § SpaceNav.

export interface SpaceView {
  key: string;
  label: string;
}

interface SpaceViewOptionProps {
  viewKey: string;
  label: string;
  onSelect: (key: string) => void;
}

const SpaceViewOption: React.FC<SpaceViewOptionProps> = ({
  viewKey,
  label,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(viewKey);
  }, [onSelect, viewKey]);
  return (
    <button
      type='button'
      className='space-view-picker__option'
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

interface SpaceViewPickerProps {
  views: SpaceView[];
  current: string;
  onChange: (key: string) => void;
}

export const SpaceViewPicker: React.FC<SpaceViewPickerProps> = ({
  views,
  current,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeView = views.find((v) => v.key === current) ?? views[0];
  const otherViews = views.filter((v) => v.key !== activeView?.key);

  const handleToggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const handleSelect = useCallback(
    (key: string) => {
      onChange(key);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (e: MouseEvent) => {
      if (
        rootRef.current &&
        e.target instanceof Node &&
        !rootRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!activeView) return null;
  // Local child so React can memoize the click handler per option
  // without violating eslint's react/jsx-no-bind on inline arrows.

  return (
    <div
      ref={rootRef}
      className='space-view-picker'
      data-open={open ? 'true' : 'false'}
    >
      <button
        type='button'
        className='space-view-picker__trigger'
        aria-haspopup='listbox'
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span className='space-view-picker__label'>{activeView.label}</span>
        <svg
          className='space-view-picker__caret'
          viewBox='0 0 12 12'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          aria-hidden='true'
        >
          <path d='M2.5 4.5 L6 8 L9.5 4.5' strokeLinecap='round' />
        </svg>
      </button>
      <div className='space-view-picker__options' role='listbox'>
        {otherViews.map((view) => (
          <SpaceViewOption
            key={view.key}
            viewKey={view.key}
            label={view.label}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
};
