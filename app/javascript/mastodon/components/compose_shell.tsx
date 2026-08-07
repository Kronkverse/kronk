import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// ComposeShell — the shared floating composer frame every korner's
// composer body renders inside. Every /hub/<slug>/composer surface
// looks the same from the outside: a portal-mounted panel over a
// dim backdrop, korner icon + label + optional subtitle in the
// header, a body slot for the korner-specific fields, and a
// Cancel + primary-submit footer bar. Escape / backdrop click both
// close. Reads as one place across the site (Tal 2026-08-07,
// "standardise this across the site").
//
// The shell is deliberately layout-only. It renders no fields; the
// body component (AlbumComposer / MomentsComposer / …) owns its own
// state + submit handler + validation. The shell surfaces two
// callbacks — `onSubmit` and `onCancel` — and passes them through
// to the footer bar; the body just tells the shell whether the
// submit button should be enabled + which label it wears mid-flight.
//
// Multi-composer korners (Maps: Post + Place; Albutts: Album +
// Contribute) can render a small chip pair via the `switcher` slot
// at the top of the shell; single-composer korners omit it.

const messages = defineMessages({
  cancel: { id: 'compose_shell.cancel', defaultMessage: 'Cancel' },
  close: { id: 'compose_shell.close', defaultMessage: 'Close' },
});

interface ComposeShellProps {
  // Korner slug — used to render the header icon from the korner's
  // own manifest (matches the sidebar / space badge treatment).
  korner: string;
  // Primary label — "New album", "Share a Moment", "Drop a place".
  label: string;
  // Optional supporting line under the label. e.g. "Gone in 24
  // hours." for Moments, "3 photos ready to upload" for Albutts.
  subtitle?: string;
  // The primary CTA label. Body controls what it says mid-flight
  // (e.g. "Sharing…") via `submitting` + `submittingLabel`.
  submitLabel: string;
  submittingLabel?: string;
  submitting?: boolean;
  canSubmit?: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  // Optional composer-picker chips rendered at the top of the shell
  // for korners with more than one composer flow (Maps: Post /
  // Place). Body owns the rendering.
  switcher?: React.ReactNode;
  children: React.ReactNode;
}

export const ComposeShell: React.FC<ComposeShellProps> = ({
  korner,
  label,
  subtitle,
  submitLabel,
  submittingLabel,
  submitting = false,
  canSubmit = true,
  onSubmit,
  onCancel,
  switcher,
  children,
}) => {
  const intl = useIntl();
  const KornerIconComponent = useKornerIcon(korner);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onCancel, submitting]);

  const handleSubmit = useCallback(() => {
    if (canSubmit && !submitting) onSubmit();
  }, [canSubmit, submitting, onSubmit]);

  const primaryText =
    submitting && submittingLabel ? submittingLabel : submitLabel;

  return createPortal(
    <div
      className='compose-shell'
      role='dialog'
      aria-modal='true'
      aria-label={label}
    >
      <button
        type='button'
        className='compose-shell__backdrop'
        onClick={onCancel}
        aria-label={intl.formatMessage(messages.close)}
        disabled={submitting}
      />
      <div className='compose-shell__panel'>
        <header className='compose-shell__header'>
          <span className='compose-shell__icon' aria-hidden='true'>
            <Icon id={`compose-${korner}`} icon={KornerIconComponent} />
          </span>
          <div className='compose-shell__titles'>
            <h2 className='compose-shell__label'>{label}</h2>
            {subtitle && <p className='compose-shell__subtitle'>{subtitle}</p>}
          </div>
          <button
            type='button'
            className='compose-shell__close'
            onClick={onCancel}
            disabled={submitting}
            aria-label={intl.formatMessage(messages.close)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </header>

        {switcher && <div className='compose-shell__switcher'>{switcher}</div>}

        <div className='compose-shell__body'>{children}</div>

        <footer className='compose-shell__footer'>
          <button
            type='button'
            className='compose-shell__cancel'
            onClick={onCancel}
            disabled={submitting}
          >
            <FormattedMessage {...messages.cancel} />
          </button>
          <button
            type='button'
            className='compose-shell__submit'
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {primaryText}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
