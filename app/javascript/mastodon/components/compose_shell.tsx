import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { DraftBar } from 'mastodon/components/draft_bar';
import { Icon } from 'mastodon/components/icon';
import { KonnectRow } from 'mastodon/components/konnect_row';
import type { DraftControls } from 'mastodon/hooks/useDraft';
import type { KonnectControls } from 'mastodon/hooks/useKonnect';
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
// Drafts (docs/design.md, Drafts): a composer that keeps drafts passes its
// `useDraft()` result as `draft`. Saving is silent; the shell draws the
// drafts line under the body only when a draft was picked up. Closing (Cancel, ×, Escape, the backdrop) keeps the draft: the
// hook saves on the way out, so nothing here asks "are you sure?".
//
// Konnect (decisions.md, 2026-10-23, "One composer, one Konnect"; Korner
// Standard L14): every composer says what it Konnects. It passes its
// `useKonnect()` result as `konnect`, and the shell draws the Konnect row
// at the foot of the body, above the drafts line: the records waiting as
// space tiles, and a Konnect tile to add one. The composer calls
// `konnect.commit(slug, id)` once its create succeeds. The prop is required,
// so a composer can't leave Konnect out by forgetting it; `null` is for the
// composers that make nothing new to Konnect: editing a record (Konnect it
// from its page), adding to one that exists (photos to an album), and
// korners that opt out (`no_attachments:`, e.g. Moments).
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
  // Optional chrome control that sits inside the shell header on the
  // right, before the close button. Used for reach controls that need
  // to read as chrome (the "who sees this?" ReachDropdown in the
  // feed-card composer shape from #1230).
  headerAction?: React.ReactNode;
  // The composer's drafts, from `useDraft()`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft?: DraftControls<any>;
  // The composer's Konnections, from `useKonnect()`; `null` when it makes
  // nothing new to Konnect (see above).
  konnect: KonnectControls | null;
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
  headerAction,
  draft,
  konnect,
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
          {headerAction && (
            <div className='compose-shell__header-action'>{headerAction}</div>
          )}
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

        <div className='compose-shell__body'>
          {children}
          {konnect && <KonnectRow konnect={konnect} disabled={submitting} />}
          {draft && (
            <DraftBar draft={draft} disabled={submitting || draft.locked} />
          )}
        </div>

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
