import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import type { DraftControls } from 'mastodon/hooks/useDraft';

// DraftBar — the Drafts row at the top of every composer that saves drafts
// (docs/design.md, Drafts). <ComposeShell draft={…}> renders it; a composer
// never draws its own. Shown once there is a draft: a chip per draft (tap
// to switch; the one open is lit), Start another (leaves this one saved),
// Discard draft (asks first) and how saving is going.

const messages = defineMessages({
  label: { id: 'drafts.bar.label', defaultMessage: 'Drafts' },
  startNew: { id: 'drafts.bar.start_new', defaultMessage: 'Start another' },
  discard: { id: 'drafts.bar.discard', defaultMessage: 'Discard draft' },
  discardTitle: {
    id: 'drafts.bar.discard_title',
    defaultMessage: 'Discard this draft?',
  },
  discardMessage: {
    id: 'drafts.bar.discard_message',
    defaultMessage:
      'What you have written here, and anything uploaded to it, goes for good.',
  },
  saving: { id: 'drafts.bar.saving', defaultMessage: 'Saving…' },
  saved: { id: 'drafts.bar.saved', defaultMessage: 'Saved' },
  offline: {
    id: 'drafts.bar.offline',
    defaultMessage: 'Saved on this device',
  },
});

const Chip = <P,>({
  draft,
  label,
  current,
  onPick,
}: {
  draft: ApiComposerDraftJSON<P>;
  label: string;
  current: boolean;
  onPick: (draft: ApiComposerDraftJSON<P>) => void;
}) => {
  const handleClick = useCallback(() => {
    if (!current) onPick(draft);
  }, [current, draft, onPick]);

  return (
    <li>
      <button
        type='button'
        className={`draft-bar__chip${current ? ' draft-bar__chip--current' : ''}`}
        aria-pressed={current}
        onClick={handleClick}
      >
        {label}
      </button>
    </li>
  );
};

export const DraftBar = <P,>({
  draft,
  disabled = false,
}: {
  draft: DraftControls<P>;
  disabled?: boolean;
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const { drafts, currentId, status, hasContent, discard } = draft;

  const handleDiscard = useCallback(() => {
    void confirm({
      title: intl.formatMessage(messages.discardTitle),
      message: intl.formatMessage(messages.discardMessage),
      confirmLabel: intl.formatMessage(messages.discard),
      destructive: true,
    }).then((ok) => {
      if (ok) discard();
      return undefined;
    });
  }, [confirm, intl, discard]);

  if (!draft.active || !draft.loaded) return null;
  if (drafts.length === 0 && !currentId) return null;

  const statusText =
    status === 'saving'
      ? messages.saving
      : status === 'saved'
        ? messages.saved
        : status === 'offline'
          ? messages.offline
          : null;

  return (
    <section
      className='draft-bar'
      aria-label={intl.formatMessage(messages.label)}
    >
      {confirmDialog}
      <div className='draft-bar__head'>
        <span className='draft-bar__label'>
          {intl.formatMessage(messages.label)}
        </span>
        {statusText && (
          <span className='draft-bar__status' role='status'>
            {intl.formatMessage(statusText)}
          </span>
        )}
      </div>

      <ul className='draft-bar__chips'>
        {drafts.map((d) => (
          <Chip
            key={d.id}
            draft={d}
            label={draft.describe(d)}
            current={d.id === currentId}
            onPick={draft.switchTo}
          />
        ))}
      </ul>

      <div className='draft-bar__actions'>
        {hasContent && (
          <button
            type='button'
            className='draft-bar__action'
            onClick={draft.startNew}
            disabled={disabled}
          >
            {intl.formatMessage(messages.startNew)}
          </button>
        )}
        {currentId && (
          <button
            type='button'
            className='draft-bar__action draft-bar__action--discard'
            onClick={handleDiscard}
            disabled={disabled}
          >
            {intl.formatMessage(messages.discard)}
          </button>
        )}
      </div>
    </section>
  );
};
