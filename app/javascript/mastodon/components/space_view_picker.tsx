import { useCallback } from 'react';

// SpaceViewPicker — the per-space view selector. Renders as a
// segmented switch-pill (Booth-style Compact/Standard/Large) so all
// views are always visible and switching is one tap. Manifest-driven
// via AutoSpaceViewPicker; every /hub/<slug> that declares `views:`
// picks it up automatically.
//
// Spec: docs/kronk_frame.md § SpaceNav.

export interface SpaceView {
  key: string;
  label: string;
}

interface SpaceViewOptionProps {
  viewKey: string;
  label: string;
  pressed: boolean;
  onSelect: (key: string) => void;
}

const SpaceViewOption: React.FC<SpaceViewOptionProps> = ({
  viewKey,
  label,
  pressed,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(viewKey);
  }, [onSelect, viewKey]);
  return (
    <button
      type='button'
      className='space-view-picker__btn'
      aria-pressed={pressed}
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
  if (views.length === 0) return null;
  return (
    <div className='space-view-picker' role='group' aria-label='Views'>
      {views.map((view) => (
        <SpaceViewOption
          key={view.key}
          viewKey={view.key}
          label={view.label}
          pressed={view.key === current}
          onSelect={onChange}
        />
      ))}
    </div>
  );
};
