import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import classNames from 'classnames';

// ConfirmDialog — the "are you sure?" primitive. Delete an event, leave
// a Krew, cancel an RSVP, discard a draft. Portal-mounted like
// `<ComposeShell>`, dim backdrop, Escape + backdrop click cancel.
// Replaces bespoke `openModal({ modalType: 'CONFIRM_…' })` dispatches
// (each of which today requires registering a new modal type in
// modal_root) and the uglier `if (!window.confirm(…))` guards
// (native browser dialogs — see `krew_detail`, `event_detail`).
//
// Declarative — parent owns the open state and renders the component
// conditionally. Use `useConfirmDialog` (see hook of same name) for
// the imperative Promise-returning style if the caller doesn't want
// to manage state.

const messages = defineMessages({
  cancel: { id: 'confirm_dialog.cancel', defaultMessage: 'Cancel' },
});

interface ConfirmDialogProps {
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel: React.ReactNode;
  // Optional label shown on the primary CTA while the confirm handler
  // is in flight. Body owns the `busy` flag; the shell just swaps the
  // label + disables the buttons.
  confirmingLabel?: React.ReactNode;
  // Optional cancel label — defaults to "Cancel". Change when the
  // negative action reads better as e.g. "Keep it" / "Never mind".
  cancelLabel?: React.ReactNode;
  // Signals the confirmation is a destructive action (delete, cancel,
  // leave). Styles the primary CTA in Kronk's warn/red palette.
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  confirmingLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const intl = useIntl();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onCancel, busy]);

  // Focus the primary CTA on mount so Enter confirms. Users came here
  // to make a decision; the button that matters is the destructive one.
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!busy) onConfirm();
  }, [busy, onConfirm]);

  const primaryText = busy && confirmingLabel ? confirmingLabel : confirmLabel;

  return createPortal(
    <div
      className='confirm-dialog'
      role='alertdialog'
      aria-modal='true'
      aria-labelledby='confirm-dialog__title'
    >
      <button
        type='button'
        className='confirm-dialog__backdrop'
        onClick={onCancel}
        aria-label={intl.formatMessage(messages.cancel)}
        disabled={busy}
      />
      <div className='confirm-dialog__panel'>
        <h2 id='confirm-dialog__title' className='confirm-dialog__title'>
          {title}
        </h2>
        {message && <p className='confirm-dialog__message'>{message}</p>}
        <div className='confirm-dialog__actions'>
          <button
            type='button'
            className='confirm-dialog__cancel'
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel ?? <FormattedMessage {...messages.cancel} />}
          </button>
          <button
            ref={confirmRef}
            type='button'
            className={classNames('confirm-dialog__confirm', {
              'confirm-dialog__confirm--destructive': destructive,
            })}
            onClick={handleConfirm}
            disabled={busy}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
