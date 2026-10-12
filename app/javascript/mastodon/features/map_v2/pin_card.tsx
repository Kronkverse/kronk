import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiPlacePresence } from 'mastodon/api/map';
import type { ApiPresencePinJSON } from 'mastodon/api/map';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

// Map — pin card. Opens when someone taps a mate's pin (solo teardrop,
// off-map compass mark, in-view row, or people-strip tile). Renders a
// floating card with their face, name, "Here since <relative date>",
// their short blurb, and a link to their profile.
//
// On the viewer's own pin, the note is editable in place: pencil →
// input → save. Save re-uses `POST /api/v1/map/presence` with the
// current coord + precision so PresenceState treats it as a note-only
// edit and keeps `placed_at` stable (the "Here since" line stays put).
//
// Mirrors the shipped `.kronk-orb__card` pattern from the Kommunity
// orb tap card — bottom-left overlay, purple ring, close ×.

// Match PresenceState::MAX_NOTE_LENGTH so a value that would 422 on the
// server can't be typed here.
const NOTE_MAX_LENGTH = 60;

const messages = defineMessages({
  close: { id: 'map.pin_card.close', defaultMessage: 'Close' },
  viewProfile: {
    id: 'map.pin_card.view_profile',
    defaultMessage: 'View profile',
  },
  editNote: { id: 'map.pin_card.edit_note', defaultMessage: 'Edit blurb' },
  notePlaceholder: {
    id: 'map.pin_card.note_placeholder',
    defaultMessage: "What are you up to? (e.g. 'Travelling China')",
  },
  saveNote: { id: 'map.pin_card.save_note', defaultMessage: 'Save' },
  cancelEdit: { id: 'map.pin_card.cancel_edit', defaultMessage: 'Cancel' },
  addNote: { id: 'map.pin_card.add_note', defaultMessage: 'Add a blurb' },
  saveFailed: {
    id: 'map.pin_card.save_failed',
    defaultMessage: "Couldn't save — try again.",
  },
});

interface Props {
  pin: ApiPresencePinJSON;
  onClose: () => void;
  onNoteSaved?: (pin: ApiPresencePinJSON) => void;
}

export const PinCard: React.FC<Props> = ({ pin, onClose, onNoteSaved }) => {
  const intl = useIntl();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(pin.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // When the pin the card is showing changes (viewer selects a
  // different mate), reset the edit UI so a half-finished draft on one
  // person doesn't carry over to the next.
  useEffect(() => {
    setEditing(false);
    setDraft(pin.note ?? '');
    setError(null);
  }, [pin.account_id, pin.note]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const beginEdit = useCallback(() => {
    setDraft(pin.note ?? '');
    setError(null);
    setEditing(true);
  }, [pin.note]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(pin.note ?? '');
    setError(null);
  }, [pin.note]);

  const handleDraftChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(event.target.value);
    },
    [],
  );

  const saveDraft = useCallback(() => {
    const trimmed = draft.trim();
    // Note-only edit: re-send the coord we already have so
    // PresenceState.place! sees an unchanged position and leaves
    // `placed_at` alone. `label` is preserved so the tooltip caption
    // survives the edit.
    setSaving(true);
    setError(null);
    apiPlacePresence({
      lat: pin.lat,
      lng: pin.lng,
      precision: pin.precision,
      share_scope: 'friends',
      label: pin.label ?? undefined,
      note: trimmed.length > 0 ? trimmed : undefined,
    })
      .then((updated) => {
        setEditing(false);
        onNoteSaved?.(updated);
      })
      .catch(() => {
        setError(intl.formatMessage(messages.saveFailed));
      })
      .finally(() => {
        setSaving(false);
      });
  }, [draft, pin, onNoteSaved, intl]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      saveDraft();
    },
    [saveDraft],
  );

  const profileHref = `/@${pin.handle}`;
  const hasNote = pin.note !== null && pin.note.length > 0;

  return (
    <div className='map-pin-card' role='dialog' aria-label={pin.name}>
      <button
        type='button'
        className='map-pin-card__close'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>

      <div className='map-pin-card__head'>
        <span
          className='map-pin-card__avatar'
          style={{ backgroundImage: `url("${pin.avatar}")` }}
        />
        <div className='map-pin-card__names'>
          <div className='map-pin-card__display'>{pin.name}</div>
          <div className='map-pin-card__handle'>@{pin.handle}</div>
        </div>
      </div>

      <div className='map-pin-card__since'>
        <FormattedMessage
          id='map.pin_card.here_since'
          defaultMessage='Here since {when}'
          values={{ when: <RelativeTimestamp timestamp={pin.placed_at} /> }}
        />
      </div>

      {pin.label && <div className='map-pin-card__place'>{pin.label}</div>}

      {/* Note block. Three states:
          1. Someone else's pin, note present → read-only line.
          2. Someone else's pin, no note → suppress the block entirely.
          3. Own pin → always visible: read line + pencil, or the edit
             form when `editing` is on. */}
      {pin.self ? (
        editing ? (
          <form className='map-pin-card__note-form' onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type='text'
              className='map-pin-card__note-input'
              value={draft}
              onChange={handleDraftChange}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={intl.formatMessage(messages.notePlaceholder)}
              disabled={saving}
            />
            <div className='map-pin-card__note-actions'>
              <button
                type='button'
                className='map-pin-card__note-cancel'
                onClick={cancelEdit}
                disabled={saving}
              >
                {intl.formatMessage(messages.cancelEdit)}
              </button>
              <button
                type='submit'
                className='map-pin-card__note-save'
                disabled={saving}
              >
                {intl.formatMessage(messages.saveNote)}
              </button>
            </div>
            {error && <div className='map-pin-card__note-error'>{error}</div>}
          </form>
        ) : (
          <button
            type='button'
            className={`map-pin-card__note map-pin-card__note--editable${hasNote ? '' : ' map-pin-card__note--empty'}`}
            onClick={beginEdit}
            aria-label={intl.formatMessage(messages.editNote)}
          >
            <span className='map-pin-card__note-text'>
              {hasNote ? pin.note : intl.formatMessage(messages.addNote)}
            </span>
            <Icon
              id='edit'
              icon={EditIcon}
              className='map-pin-card__note-edit-icon'
            />
          </button>
        )
      ) : (
        hasNote && <div className='map-pin-card__note'>{pin.note}</div>
      )}

      <a
        className='map-pin-card__profile'
        href={profileHref}
        target='_blank'
        rel='noopener noreferrer'
      >
        {intl.formatMessage(messages.viewProfile)}
      </a>
    </div>
  );
};
