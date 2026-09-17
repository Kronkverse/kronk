import type { ReactNode } from 'react';

// One setting row: label + optional description on the left, the
// widget on the right. On narrow viewports the widget wraps below.
//
// The widget is any React child — a toggle, radio, dropdown, custom
// picker — the row doesn't care. Pages that render a bare
// `NamedSettingRow` (schema-driven) can wrap it here to gain the
// shared row chrome and label styling.

interface Props {
  label: string;
  description?: string;
  // The interactive control. Any element.
  children: ReactNode;
  // If true, stacks label+widget vertically even on wide viewports —
  // useful when the widget is itself wide (a slider, a colour picker
  // strip, a Reach picker with multiple boxes).
  stack?: boolean;
}

export const SettingsRow: React.FC<Props> = ({
  label,
  description,
  children,
  stack = false,
}) => (
  <div
    className={`settings-page__row${stack ? ' settings-page__row--stack' : ''}`}
  >
    <div className='settings-page__row-body'>
      <div className='settings-page__row-label'>{label}</div>
      {description && (
        <div className='settings-page__row-desc'>{description}</div>
      )}
    </div>
    <div className='settings-page__row-widget'>{children}</div>
  </div>
);
