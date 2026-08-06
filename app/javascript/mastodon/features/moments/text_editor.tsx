// Moments text-overlay editor — the Signal-Stories-shape editor
// that opens between "picked a photo" and "posted a moment". The
// user drops text layers on top of the image, drags them around,
// resizes / rotates, picks colour + backing + font. Output is a
// `TextOverlay[]` written to the moments.text_overlays JSONB column.
//
// The visual language is deliberately kin to the read-only viewer:
// each overlay is rendered by the same `<OverlayText>` primitive
// from ./text_overlay.tsx, wrapped here in gesture handling. What
// you see in the editor is exactly what lands in the viewer, at
// the correct aspect. `x` / `y` / `width` / `size` are 0..1
// normalised so the editor's arbitrary viewport size doesn't
// disagree with the viewer's 3:4 stage.
//
// Gestures use `@use-gesture/react` (already in package.json). Drag
// moves the selected overlay; the bottom-right corner handle
// resizes and rotates together (Signal pattern — corner-drag
// updates both `size` and `rotation` from a single gesture).

import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { useDrag } from '@use-gesture/react';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';

import type { OverlayBacking, OverlayFont, TextOverlay } from './text_overlay';
import { OVERLAY_COLORS, OverlayText, newOverlay } from './text_overlay';

const messages = defineMessages({
  title: {
    id: 'moments.text_editor.title',
    defaultMessage: 'Add text',
  },
  addText: {
    id: 'moments.text_editor.add_text',
    defaultMessage: 'Add text',
  },
  editText: {
    id: 'moments.text_editor.edit_text',
    defaultMessage: 'Edit text',
  },
  done: {
    id: 'moments.text_editor.done',
    defaultMessage: 'Done',
  },
  cancel: {
    id: 'moments.text_editor.cancel',
    defaultMessage: 'Cancel',
  },
  delete: {
    id: 'moments.text_editor.delete',
    defaultMessage: 'Delete',
  },
  next: {
    id: 'moments.text_editor.next',
    defaultMessage: 'Next',
  },
  prev: {
    id: 'moments.text_editor.prev',
    defaultMessage: 'Back',
  },
  photoOfTotal: {
    id: 'moments.text_editor.photo_of_total',
    defaultMessage: 'Photo {current} of {total}',
  },
});

// UUID-ish id generator. Overlays are ephemeral (per-Moment, 24h
// lifetime); the id only needs to be unique within one Moment's
// array. `crypto.randomUUID` is widely supported; the fallback
// covers old browsers without pulling `uuid` in.
const overlayId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
};

const FONT_OPTIONS: { value: OverlayFont; label: string }[] = [
  { value: 'body', label: 'Aa' },
  { value: 'display', label: 'Aa' },
  { value: 'mono', label: 'Aa' },
];

const BACKING_OPTIONS: OverlayBacking[] = ['none', 'dark', 'light', 'accent'];

interface Props {
  // The picked file's raw blob — the editor reads its pixels via
  // `URL.createObjectURL` to render the preview at true aspect.
  file: File;
  // Existing overlays for this photo (empty on first open). The
  // editor owns its own local draft and only commits back to the
  // parent when the user taps Done.
  initial: TextOverlay[];
  // Multi-photo context — the editor renders a "Photo M of N" hint
  // and (when N > 1) a Next affordance so the user can flow through
  // several photos without closing the editor.
  index: number;
  total: number;
  onCancel: () => void;
  onCommit: (overlays: TextOverlay[]) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const MomentsTextEditor: React.FC<Props> = ({
  file,
  initial,
  index,
  total,
  onCancel,
  onCommit,
  onNext,
  onPrev,
}) => {
  const intl = useIntl();
  const [overlays, setOverlays] = useState<TextOverlay[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial[0]?.id ?? null,
  );
  const [editingText, setEditingText] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Preview URL from the picked File. Revoked on unmount so we
  // don't leak object URLs across a batch of photos.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const selected = useMemo(
    () => overlays.find((o) => o.id === selectedId) ?? null,
    [overlays, selectedId],
  );

  const updateOverlay = useCallback(
    (id: string, patch: Partial<TextOverlay>) => {
      setOverlays((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      );
    },
    [],
  );

  const removeOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const addOverlay = useCallback(() => {
    const fresh = newOverlay(overlayId());
    setOverlays((prev) => [...prev, fresh]);
    setSelectedId(fresh.id);
    setEditingText(fresh.text);
  }, []);

  const commitTextEdit = useCallback(
    (id: string, text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') {
        removeOverlay(id);
      } else {
        updateOverlay(id, { text: trimmed });
      }
      setEditingText(null);
    },
    [removeOverlay, updateOverlay],
  );

  // Drop empties on commit — a blank overlay is a mid-edit artefact
  // (user tapped Add, walked away without typing).
  const handleDone = useCallback(() => {
    const kept = overlays.filter((o) => o.text.trim().length > 0);
    onCommit(kept);
  }, [overlays, onCommit]);

  const handleStageTap = useCallback(
    (event: React.MouseEvent | React.PointerEvent) => {
      // Tap on the empty stage → deselect. Tap on a specific overlay
      // is handled in <EditableOverlay> and stops propagation.
      if (event.target === stageRef.current) {
        setSelectedId(null);
      }
    },
    [],
  );

  const handleStageDoubleTap = useCallback(() => {
    // Double-tap the stage → add a new text layer at centre. Signal
    // Stories does the same. Single tap of the "+" button in the
    // toolbar is the discoverable path; double-tap is the shortcut.
    addOverlay();
  }, [addOverlay]);

  // Stable, parent-scoped, id-aware callbacks. Bound children
  // (EditableOverlay, InlineTextInput, SelectedControls) close over
  // just the id they need, so the map JSX below never creates a
  // fresh arrow per item (react/jsx-no-bind).
  const handleOverlaySelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);
  const handleOverlayEditRequest = useCallback((id: string, text: string) => {
    setSelectedId(id);
    setEditingText(text);
  }, []);
  const handleOverlayChange = useCallback(
    (id: string, patch: Partial<TextOverlay>) => {
      updateOverlay(id, patch);
    },
    [updateOverlay],
  );
  const handleOverlayCommitText = useCallback(
    (id: string, text: string) => {
      commitTextEdit(id, text);
    },
    [commitTextEdit],
  );
  // For SelectedControls: it always operates on the currently-
  // selected overlay, so its callbacks close over `selectedId` from
  // state and dispatch to the id-aware helpers above.
  const handleSelectedChange = useCallback(
    (patch: Partial<TextOverlay>) => {
      if (selectedId) updateOverlay(selectedId, patch);
    },
    [selectedId, updateOverlay],
  );
  const handleSelectedEditText = useCallback(() => {
    if (selected) setEditingText(selected.text);
  }, [selected]);
  const handleSelectedDelete = useCallback(() => {
    if (selectedId) removeOverlay(selectedId);
  }, [selectedId, removeOverlay]);

  // Escape closes without committing; Enter commits when editing
  // text on the stage.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [onCancel]);

  return createPortal(
    <div
      className='moments-text-editor'
      role='dialog'
      aria-label={intl.formatMessage(messages.title)}
    >
      <header className='moments-text-editor__header'>
        <button
          type='button'
          className='moments-text-editor__cancel'
          onClick={onCancel}
          aria-label={intl.formatMessage(messages.cancel)}
        >
          <CloseIcon />
        </button>
        <div className='moments-text-editor__title'>
          {total > 1 && (
            <FormattedMessage
              {...messages.photoOfTotal}
              values={{ current: index + 1, total }}
            />
          )}
        </div>
        <button
          type='button'
          className='moments-text-editor__done'
          onClick={handleDone}
        >
          <FormattedMessage {...(onNext ? messages.next : messages.done)} />
        </button>
      </header>

      {/*
        The stage is a presentational surface — a big canvas the
        user manipulates via touch/mouse. Keyboard interaction
        happens via the toolbar buttons (Add / Done / Cancel) and
        Escape via a window keydown listener above. role="presentation"
        tells assistive tech to look through this container for the
        real interactive descendants.
      */}
      <div
        ref={stageRef}
        role='presentation'
        className='moments-text-editor__stage'
        onClick={handleStageTap}
        onDoubleClick={handleStageDoubleTap}
      >
        {previewUrl && (
          <img
            className='moments-text-editor__image'
            src={previewUrl}
            alt=''
            aria-hidden
            draggable={false}
          />
        )}
        <div className='moments-text-editor__overlays'>
          {overlays.map((o) =>
            editingText !== null && o.id === selectedId ? (
              // Inline text editor while typing — swaps in for the
              // rendered overlay so the user sees the layer they're
              // editing at position, not floating in a modal.
              <InlineTextInput
                key={o.id}
                overlay={o}
                value={editingText}
                onChange={setEditingText}
                onCommit={handleOverlayCommitText}
              />
            ) : (
              <EditableOverlay
                key={o.id}
                overlay={o}
                selected={o.id === selectedId}
                stageRef={stageRef}
                onSelect={handleOverlaySelect}
                onEdit={handleOverlayEditRequest}
                onChange={handleOverlayChange}
              />
            ),
          )}
        </div>

        {overlays.length === 0 && (
          <button
            type='button'
            className='moments-text-editor__empty-cta'
            onClick={addOverlay}
          >
            <AddIcon />
            <FormattedMessage {...messages.addText} />
          </button>
        )}
      </div>

      <footer className='moments-text-editor__toolbar'>
        {selected ? (
          <SelectedControls
            overlay={selected}
            onChange={handleSelectedChange}
            onEditText={handleSelectedEditText}
            onDelete={handleSelectedDelete}
          />
        ) : (
          <div className='moments-text-editor__toolbar-empty'>
            {onPrev && (
              <button
                type='button'
                className='moments-text-editor__nav'
                onClick={onPrev}
              >
                <FormattedMessage {...messages.prev} />
              </button>
            )}
            <button
              type='button'
              className='moments-text-editor__add'
              onClick={addOverlay}
            >
              <AddIcon />
              <FormattedMessage {...messages.addText} />
            </button>
            {onNext && <span className='moments-text-editor__nav-spacer' />}
          </div>
        )}
      </footer>
    </div>,
    document.body,
  );
};

// The interactive wrapper around one overlay. Handles selection,
// dragging (via `useDrag`) and exposes a corner handle for the
// combined resize+rotate gesture (Signal pattern: pull the handle
// away from centre to grow; twist to rotate).
// Parent-scoped, id-aware handlers keep the JSX map at the call
// site free of per-item arrow functions (react/jsx-no-bind).
const EditableOverlay: React.FC<{
  overlay: TextOverlay;
  selected: boolean;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onChange: (id: string, patch: Partial<TextOverlay>) => void;
}> = ({ overlay, selected, stageRef, onSelect, onEdit, onChange }) => {
  const rectRef = useRef<{ w: number; h: number; l: number; t: number } | null>(
    null,
  );

  // Cache stage dims at drag-start so we can express deltas in the
  // overlay's 0..1 coordinate space without reading layout on every
  // pointer event.
  const readStageRect = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { w: r.width, h: r.height, l: r.left, t: r.top };
  }, [stageRef]);

  // Body drag: reposition the overlay's centre. Distance-in-pixels
  // gets divided by stage width/height to stay in 0..1 space.
  const bindBody = useDrag(
    ({ first, delta: [dx, dy], event }) => {
      event.stopPropagation();
      if (first) rectRef.current = readStageRect();
      const rect = rectRef.current;
      if (!rect) return;
      onChange(overlay.id, {
        x: clamp(overlay.x + dx / rect.w, 0, 1),
        y: clamp(overlay.y + dy / rect.h, 0, 1),
      });
    },
    { pointer: { touch: true } },
  );

  // Corner handle drag: combined resize + rotate. `size` scales
  // with radial distance from centre; `rotation` follows the angle.
  // This is the Signal shape — one gesture controls both, so a
  // "grab handle and twist while pulling" reads as expected.
  const bindHandle = useDrag(
    ({ first, xy: [px, py], event }) => {
      event.stopPropagation();
      if (first) rectRef.current = readStageRect();
      const rect = rectRef.current;
      if (!rect) return;

      // Overlay centre in stage-local coords.
      const cx = rect.l + overlay.x * rect.w;
      const cy = rect.t + overlay.y * rect.h;
      const dx = px - cx;
      const dy = py - cy;
      const radius = Math.sqrt(dx * dx + dy * dy);
      // Normalise radius against stage height so the resulting `size`
      // stays 0..1 in the same coordinate space the overlay renders in.
      // × 2 because size is font-size and the radial distance from
      // centre to a corner is roughly one font-em (empirical fit).
      const newSize = clamp((radius / rect.h) * 2, 0.02, 0.4);
      // Angle to the handle relative to the "handle at bottom-right"
      // resting position (45°). Editor rotates the whole layer, so
      // we subtract 45° to normalise.
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 45;
      onChange(overlay.id, { size: newSize, rotation: angle });
    },
    { pointer: { touch: true } },
  );

  const handleClick = useCallback(
    (event: ReactPointerEvent) => {
      event.stopPropagation();
      if (selected) return;
      onSelect(overlay.id);
    },
    [selected, onSelect, overlay.id],
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onEdit(overlay.id, overlay.text);
    },
    [onEdit, overlay.id, overlay.text],
  );

  return (
    <div
      className={`moments-text-editor__layer${selected ? ' moments-text-editor__layer--selected' : ''}`}
      style={{
        left: `${(overlay.x * 100).toString()}%`,
        top: `${(overlay.y * 100).toString()}%`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation.toString()}deg)`,
      }}
      {...bindBody()}
      onPointerDown={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <OverlayText overlay={{ ...overlay, x: 0.5, y: 0.5, rotation: 0 }} />
      {selected && (
        <span className='moments-text-editor__handle' {...bindHandle()} />
      )}
    </div>
  );
};

// Inline text input rendered *at* the overlay's position (not in a
// modal) so the user types where the text will land. Enter or blur
// commits; Escape reverts by committing the current value (the
// caller drops empties). `onCommit` is id-aware so it can be shared
// stably across the map without an inline arrow at the call site.
const InlineTextInput: React.FC<{
  overlay: TextOverlay;
  value: string;
  onChange: (v: string) => void;
  onCommit: (id: string, v: string) => void;
}> = ({ overlay, value, onChange, onCommit }) => {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    onCommit(overlay.id, value);
  }, [onCommit, overlay.id, value]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onCommit(overlay.id, value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCommit(overlay.id, value);
      }
    },
    [onCommit, overlay.id, value],
  );

  return (
    <textarea
      ref={inputRef}
      className='moments-text-editor__input'
      style={{
        left: `${(overlay.x * 100).toString()}%`,
        top: `${(overlay.y * 100).toString()}%`,
        maxWidth: `${(overlay.width * 100).toString()}%`,
        fontSize: `${(overlay.size * 100).toString()}cqh`,
        transform: `translate(-50%, -50%) rotate(${overlay.rotation.toString()}deg)`,
        color: overlay.color,
        fontFamily:
          overlay.font === 'display'
            ? 'var(--font-display)'
            : overlay.font === 'mono'
              ? 'var(--font-mono)'
              : 'var(--font-body)',
      }}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKey}
      onBlur={handleBlur}
      rows={1}
      placeholder=''
      aria-label='Overlay text'
    />
  );
};

// Toolbar controls that appear at the bottom when an overlay is
// selected — font, colour, backing, edit, delete. Kept as a leaf
// component so the parent doesn't rerender the whole editor on
// every swatch tap. Each option row is a small leaf too so the
// per-item onClick lives inside a component (not an inline arrow
// in a `.map`, which trips react/jsx-no-bind).
const SelectedControls: React.FC<{
  overlay: TextOverlay;
  onChange: (patch: Partial<TextOverlay>) => void;
  onEditText: () => void;
  onDelete: () => void;
}> = ({ overlay, onChange, onEditText, onDelete }) => {
  return (
    <div className='moments-text-editor__controls'>
      <div className='moments-text-editor__control-row'>
        {FONT_OPTIONS.map((opt) => (
          <FontSwatch
            key={opt.value}
            option={opt}
            active={overlay.font === opt.value}
            onChange={onChange}
          />
        ))}
        <span className='moments-text-editor__control-divider' />
        {BACKING_OPTIONS.map((b) => (
          <BackingSwatch
            key={b}
            backing={b}
            active={overlay.backing === b}
            onChange={onChange}
          />
        ))}
      </div>
      <div className='moments-text-editor__control-row'>
        {OVERLAY_COLORS.map((c) => (
          <ColorSwatch
            key={c}
            color={c}
            active={overlay.color === c}
            onChange={onChange}
          />
        ))}
        <span className='moments-text-editor__control-divider' />
        <button
          type='button'
          className='moments-text-editor__edit'
          onClick={onEditText}
        >
          <FormattedMessage
            id='moments.text_editor.edit_text'
            defaultMessage='Edit text'
          />
        </button>
        <button
          type='button'
          className='moments-text-editor__delete'
          onClick={onDelete}
          aria-label='Delete'
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
};

const FontSwatch: React.FC<{
  option: (typeof FONT_OPTIONS)[number];
  active: boolean;
  onChange: (patch: Partial<TextOverlay>) => void;
}> = ({ option, active, onChange }) => {
  const handleClick = useCallback(() => {
    onChange({ font: option.value });
  }, [onChange, option.value]);
  return (
    <button
      type='button'
      className={`moments-text-editor__font moments-text-editor__font--${option.value}${active ? ' is-active' : ''}`}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={`Font ${option.value}`}
    >
      {option.label}
    </button>
  );
};

const BackingSwatch: React.FC<{
  backing: OverlayBacking;
  active: boolean;
  onChange: (patch: Partial<TextOverlay>) => void;
}> = ({ backing, active, onChange }) => {
  const handleClick = useCallback(() => {
    onChange({ backing });
  }, [onChange, backing]);
  return (
    <button
      type='button'
      className={`moments-text-editor__backing moments-text-editor__backing--${backing}${active ? ' is-active' : ''}`}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={`Backing ${backing}`}
    >
      T
    </button>
  );
};

const ColorSwatch: React.FC<{
  color: string;
  active: boolean;
  onChange: (patch: Partial<TextOverlay>) => void;
}> = ({ color, active, onChange }) => {
  const handleClick = useCallback(() => {
    onChange({ color });
  }, [onChange, color]);
  return (
    <button
      type='button'
      className={`moments-text-editor__color${active ? ' is-active' : ''}`}
      style={{ background: color }}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={`Colour ${color}`}
    />
  );
};

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
