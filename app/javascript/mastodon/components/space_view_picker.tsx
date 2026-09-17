import { useCallback } from 'react';

import { Icon } from 'mastodon/components/icon';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

// SpaceViewPicker — the per-space view selector. Renders as a
// segmented switch-pill (Booth-style Compact/Standard/Large) so all
// views are always visible and switching is one tap. Manifest-driven
// via AutoSpaceViewPicker; every /hub/<slug> that declares `views:`
// picks it up automatically.
//
// Each view is rendered as text OR as an icon: if the manifest entry
// carries an `icon` field, the icon is drawn and the `label` rides
// on aria-label + tooltip (site-wide direction 2026-08-04 —
// horizontal pillar navs prefer icon-only rendering). Views without
// an icon still fall back to text so the picker degrades gracefully
// while other korners' manifests are being updated.
//
// Spec: docs/kronk_frame.md § SpaceNav.

export interface SpaceView {
  key: string;
  label: string;
  icon?: string;
}

interface SpaceViewOptionProps {
  viewKey: string;
  label: string;
  icon?: string;
  pressed: boolean;
  onSelect: (key: string) => void;
}

const SpaceViewOption: React.FC<SpaceViewOptionProps> = ({
  viewKey,
  label,
  icon,
  pressed,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(viewKey);
  }, [onSelect, viewKey]);

  // `kornerIcon()` reused as a plain Material-Symbol resolver here
  // (passing a synthetic manifest with just the icon field). Keeps
  // one source of truth for symbol-name → component mapping so a new
  // icon added in `useKornerIcon.tsx#MATERIAL_TO_ICON` is available
  // to view pickers without a second registration point.
  const IconComponent = icon
    ? kornerIcon(viewKey, { icon: { material: icon } })
    : null;

  return (
    <button
      type='button'
      className='space-view-picker__btn'
      aria-pressed={pressed}
      aria-label={IconComponent ? label : undefined}
      title={IconComponent ? label : undefined}
      onClick={handleClick}
    >
      {IconComponent ? (
        <Icon id={icon ?? viewKey} icon={IconComponent} />
      ) : (
        label
      )}
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
          icon={view.icon}
          pressed={view.key === current}
          onSelect={onChange}
        />
      ))}
    </div>
  );
};
