import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import classNames from 'classnames';

// The composer field kit (docs/korners/korner_standard.md, L13; docs/design.md,
// Composers). Every composer builds its body from these, inside
// <ComposeShell>, so every space's composer reads alike: the title in the
// display serif, every other field in the body sans, one label size, one
// input size, one focus ring. A composer adds only the fields that are its
// own; it does not style inputs, labels or sections itself.
//
//   <ComposeTitle value={title} onChange={…} placeholder='Name it' />
//   <ComposeBody value={text} onChange={…} placeholder='Say more' />
//   <ComposeField label='Price' hint='Leave empty for free'>
//     <ComposeInput value={price} onChange={…} inputMode='decimal' />
//   </ComposeField>
//   <ComposeRow>…two or three short fields side by side…</ComposeRow>
//   <ComposeSection title='When'>…</ComposeSection>
//   <ComposeCheck label='Ask before people join' checked={…} onChange={…} />
//   <ComposeHint error>{error}</ComposeHint>
//
// Not here, on purpose: location and Krews. Those are Konnections (the
// Konnect row the shell draws), not fields. Who sees it is the shell's
// header reach control.

// The record's name: one line, the display serif, no box.
export const ComposeTitle = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type='text'
    className={classNames('compose-title', className)}
    {...props}
  />
));
ComposeTitle.displayName = 'ComposeTitle';

// The record's main text: a description, a body, a caption.
export const ComposeBody = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={classNames('compose-input', 'compose-input--body', className)}
    {...props}
  />
));
ComposeBody.displayName = 'ComposeBody';

// A labelled field. The label wraps its control, so it needs no id.
export const ComposeField: React.FC<{
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ label, hint, error, className, children }) => (
  <label className={classNames('compose-field', className)}>
    <span className='compose-field__label'>{label}</span>
    {children}
    {hint && <span className='compose-field__hint'>{hint}</span>}
    {error && (
      <span className='compose-field__error' role='alert'>
        {error}
      </span>
    )}
  </label>
);

export const ComposeInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={classNames('compose-input', className)}
    {...props}
  />
));
ComposeInput.displayName = 'ComposeInput';

export const ComposeTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={classNames('compose-input', className)}
    {...props}
  />
));
ComposeTextarea.displayName = 'ComposeTextarea';

export const ComposeSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={classNames('compose-input', 'compose-input--select', className)}
    {...props}
  >
    {children}
  </select>
));
ComposeSelect.displayName = 'ComposeSelect';

// A yes/no choice, label beside the box.
export const ComposeCheck: React.FC<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    label: ReactNode;
    hint?: ReactNode;
  }
> = ({ label, hint, className, ...props }) => (
  <label className={classNames('compose-check', className)}>
    <input type='checkbox' {...props} />
    <span className='compose-check__text'>
      <span className='compose-check__label'>{label}</span>
      {hint && <span className='compose-field__hint'>{hint}</span>}
    </span>
  </label>
);

// A line of help or an error that belongs to the whole composer, not one
// field.
export const ComposeHint: React.FC<{
  error?: boolean;
  children: ReactNode;
}> = ({ error, children }) => (
  <p
    className={classNames('compose-field__hint', {
      'compose-field__error': error,
    })}
    role={error ? 'alert' : undefined}
  >
    {children}
  </p>
);

// Short fields side by side (year, make, model); they stack on a phone.
export const ComposeRow: React.FC<{
  className?: string;
  children: ReactNode;
}> = ({ className, children }) => (
  <div className={classNames('compose-row', className)}>{children}</div>
);

// A group of fields under one heading.
export const ComposeSection: React.FC<{
  title: ReactNode;
  className?: string;
  children: ReactNode;
}> = ({ title, className, children }) => (
  <fieldset className={classNames('compose-section', className)}>
    <legend className='compose-section__title'>{title}</legend>
    {children}
  </fieldset>
);
