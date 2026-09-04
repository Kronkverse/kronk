// Shared settings section — the standard `[heading + hint + body]`
// wrapper every settings surface reaches for. Extracted from the
// per-korner .korner-settings__section, .krew-settings__section, and
// .data-settings__section patterns (settings audit 2026-09-04) so a
// change to spacing / typography / hint colour lands everywhere at
// once.
//
// Callers still own what lives in the body slot — this only owns the
// container, the heading, and the hint. Use SettingsRadioCards /
// setting_widgets / list_manager for the inner controls.
//
// `variant='danger'` adds a top-border and slight rhythm break for
// "Archive"-style destructive blocks at the bottom of a surface —
// same shape the bespoke krew/klot pages had.

interface Props {
  heading: React.ReactNode;
  hint?: React.ReactNode;
  variant?: 'danger';
  children?: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<Props> = ({
  heading,
  hint,
  variant,
  children,
  className,
}) => (
  <section
    className={`settings-section${
      variant ? ` settings-section--${variant}` : ''
    }${className ? ` ${className}` : ''}`}
  >
    <h3 className='settings-section__heading'>{heading}</h3>
    {hint && <p className='settings-section__hint'>{hint}</p>}
    <div className='settings-section__body'>{children}</div>
  </section>
);
