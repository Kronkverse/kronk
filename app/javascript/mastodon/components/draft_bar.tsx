import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import type { DraftControls } from 'mastodon/hooks/useDraft';

// DraftBar — the drafts line at the bottom of every composer that saves
// drafts (docs/design.md, Drafts). <ComposeShell draft={…}> renders it; a
// composer never draws its own.
//
// Drafts are quiet (decisions.md, 2026-10-22): saving says nothing, and a
// fresh composer shows nothing. Only when the composer opened on a draft
// from before does one line appear under the body: "Picked up where you
// left off · Start fresh · Discard", and, with more than one draft, "Other
// drafts (N)", which opens the list to switch to.

const messages = defineMessages({
  label: { id: 'drafts.bar.label', defaultMessage: 'Drafts' },
  pickedUp: {
    id: 'drafts.line.picked_up',
    defaultMessage: 'Picked up where you left off',
  },
  startFresh: { id: 'drafts.line.start_fresh', defaultMessage: 'Start fresh' },
  discardShort: { id: 'drafts.line.discard', defaultMessage: 'Discard' },
  others: {
    id: 'drafts.line.others',
    defaultMessage: 'Other drafts ({count})',
  },
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
  untitled: { id: 'drafts.bar.untitled', defaultMessage: 'Untitled' },
});

const Chip = <P,>({
  draft,
  label,
  disabled,
  onPick,
}: {
  draft: ApiComposerDraftJSON<P>;
  label: string;
  disabled: boolean;
  onPick: (draft: ApiComposerDraftJSON<P>) => void;
}) => {
  const handleClick = useCallback(() => {
    onPick(draft);
  }, [draft, onPick]);

  return (
    <li>
      <button
        type='button'
        className='draft-bar__chip'
        onClick={handleClick}
        disabled={disabled}
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
  const [listOpen, setListOpen] = useState(false);
  const { drafts, currentId, picked, hasContent, discard, switchTo } = draft;

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

  const handleToggleList = useCallback(() => {
    setListOpen((open) => !open);
  }, []);

  const handlePick = useCallback(
    (d: ApiComposerDraftJSON<P>) => {
      setListOpen(false);
      switchTo(d);
    },
    [switchTo],
  );

  const chipLabel = (d: ApiComposerDraftJSON<P>) => {
    const name = draft.describe(d)?.trim() ?? '';
    return name !== '' ? name : intl.formatMessage(messages.untitled);
  };

  // Nothing picked up when the composer opened: nothing to show.
  if (!draft.active || !draft.loaded || !draft.resumed) return null;

  const others = drafts.filter((d) => d.id !== currentId);
  const showPicked = picked && hasContent;
  if (!showPicked && !currentId && others.length === 0) return null;

  return (
    <section
      className='draft-bar'
      aria-label={intl.formatMessage(messages.label)}
    >
      {confirmDialog}
      <div className='draft-bar__line'>
        {showPicked && (
          <span className='draft-bar__note'>
            {intl.formatMessage(messages.pickedUp)}
          </span>
        )}
        {showPicked && (
          <button
            type='button'
            className='draft-bar__action'
            onClick={draft.startNew}
            disabled={disabled}
          >
            {intl.formatMessage(messages.startFresh)}
          </button>
        )}
        {currentId && (
          <button
            type='button'
            className='draft-bar__action'
            onClick={handleDiscard}
            disabled={disabled}
          >
            {intl.formatMessage(messages.discardShort)}
          </button>
        )}
        {others.length > 0 && (
          <button
            type='button'
            className='draft-bar__action'
            aria-expanded={listOpen}
            onClick={handleToggleList}
            disabled={disabled}
          >
            {intl.formatMessage(messages.others, { count: others.length })}
          </button>
        )}
      </div>

      {listOpen && others.length > 0 && (
        <ul className='draft-bar__chips'>
          {others.map((d) => (
            <Chip
              key={d.id}
              draft={d}
              label={chipLabel(d)}
              disabled={disabled}
              onPick={handlePick}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
