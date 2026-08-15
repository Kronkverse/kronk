import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  AttachmentCandidateJSON,
  AttachmentKind,
} from 'mastodon/api/attachments';
import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { Icon } from 'mastodon/components/icon';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// ComposeAttachBar — the compose-time attachment surface. Renders one
// `+ <Korner>` button per unique target the source manifest declares
// under `attaches:`, plus a chip strip for pending attachments. On
// submit the parent composer walks `pending`, sends the spawn/field
// intent inline in the create payload (e.g. `spawn_album: true`) and
// batch-POSTs link/reference rows against /api/v1/attachments after
// the source record's id is known.
//
// This replaces the earlier one-off `spawn_album` checkbox on the
// Kalendar composer (#1523) with a generic bar: every new attach
// target is a manifest edit + zero UI work per composer.
//
// Two kinds of + buttons:
//   * spawn + field:<name> trigger → single-tap toggle. Adds a
//     pending row with no target_id (the server materialises the
//     target through the registered factory when the field is
//     truthy on create). Second tap removes.
//   * link → opens a small single-target picker. User picks a
//     record; a pending row lands with target_id.
//
// Reference-kind entries are ignored — they're a passive mention
// pattern (e.g. a Nudge referencing an event) that a user doesn't
// consciously pick at compose time.

const messages = defineMessages({
  attach: {
    id: 'compose_attach_bar.attach',
    defaultMessage: 'Attach {korner}',
  },
  remove: {
    id: 'compose_attach_bar.remove',
    defaultMessage: 'Remove attachment',
  },
  searchPlaceholder: {
    id: 'compose_attach_bar.search_placeholder',
    defaultMessage: 'Search {korner}…',
  },
  searching: {
    id: 'compose_attach_bar.searching',
    defaultMessage: 'Searching…',
  },
  noResults: {
    id: 'compose_attach_bar.no_results',
    defaultMessage: 'No matches.',
  },
  cancel: { id: 'compose_attach_bar.cancel', defaultMessage: 'Cancel' },
});

// The API refuses `spawn` on POST — narrow the pending kind so the
// downstream committer can't accidentally try one.
type PendingKind = Exclude<AttachmentKind, never>; // spawn + link (reference ignored)

export interface PendingAttachment {
  targetSlug: string;
  targetId?: string; // undefined for spawn/field triggers
  kind: PendingKind;
  title?: string; // chip label for link/reference; undefined for spawn
}

interface ManifestEntry {
  slug: string;
  kind: PendingKind;
  triggerField?: string; // populated when kind='spawn' and trigger is 'field:<name>'
}

interface ComposeAttachBarProps {
  sourceSlug: string;
  pending: PendingAttachment[];
  onAdd: (attachment: PendingAttachment) => void;
  onRemove: (attachment: PendingAttachment) => void;
  disabled?: boolean;
}

export const ComposeAttachBar: React.FC<ComposeAttachBarProps> = ({
  sourceSlug,
  pending,
  onAdd,
  onRemove,
  disabled = false,
}) => {
  const sourceManifest = useKorner(sourceSlug);
  const [pickerFor, setPickerFor] = useState<ManifestEntry | null>(null);

  // Dedupe attaches entries by target_slug — one + button per unique
  // target korner. Preference order for the button's kind: link >
  // spawn > reference (link is the most useful compose-time action;
  // spawn falls back for source manifests that only declare a field
  // trigger; reference is user-invisible so skipped).
  const targets = useMemo<ManifestEntry[]>(() => {
    const raw = sourceManifest?.attaches ?? [];
    const bySlug = new Map<string, ManifestEntry>();

    raw.forEach((entry) => {
      if (entry.to === '*') return;
      if (entry.kind === 'reference') return;

      const existing = bySlug.get(entry.to);
      // Prefer the link entry when the manifest declares one; the
      // spawn entry stays as the fallback.
      if (existing?.kind === 'link') return;

      const triggerField =
        entry.kind === 'spawn' && entry.trigger?.startsWith('field:')
          ? entry.trigger.slice('field:'.length)
          : undefined;

      bySlug.set(entry.to, {
        slug: entry.to,
        kind: entry.kind,
        triggerField,
      });
    });

    return Array.from(bySlug.values());
  }, [sourceManifest?.attaches]);

  const handleTargetClick = useCallback(
    (entry: ManifestEntry) => {
      if (disabled) return;

      // Spawn/field: toggle the pending row directly. No picker.
      if (entry.kind === 'spawn' && entry.triggerField) {
        const existing = pending.find(
          (p) =>
            p.targetSlug === entry.slug &&
            p.kind === 'spawn' &&
            p.targetId === undefined,
        );
        if (existing) {
          onRemove(existing);
        } else {
          onAdd({ targetSlug: entry.slug, kind: 'spawn' });
        }
        return;
      }

      // Link (or any non-field trigger): open the picker.
      setPickerFor(entry);
    },
    [disabled, onAdd, onRemove, pending],
  );

  const handlePickerClose = useCallback(() => {
    setPickerFor(null);
  }, []);

  const handlePickerPicked = useCallback(
    (row: AttachmentCandidateJSON) => {
      if (!pickerFor) return;
      onAdd({
        targetSlug: pickerFor.slug,
        targetId: row.id,
        kind: pickerFor.kind,
        title: row.title ?? undefined,
      });
      setPickerFor(null);
    },
    [onAdd, pickerFor],
  );

  if (targets.length === 0) return null;

  return (
    <div className='compose-attach-bar'>
      <div className='compose-attach-bar__buttons' role='toolbar'>
        {targets.map((entry) => (
          <TargetButton
            key={entry.slug}
            entry={entry}
            active={pending.some(
              (p) =>
                p.targetSlug === entry.slug &&
                p.kind === 'spawn' &&
                p.targetId === undefined,
            )}
            disabled={disabled}
            onClick={handleTargetClick}
          />
        ))}
      </div>

      {pending.length > 0 && (
        <ul className='compose-attach-bar__chips'>
          {pending.map((p) => (
            <PendingChip
              key={`${p.targetSlug}:${p.targetId ?? 'spawn'}`}
              pending={p}
              disabled={disabled}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}

      {pickerFor && (
        <ComposeAttachPicker
          entry={pickerFor}
          onClose={handlePickerClose}
          onPicked={handlePickerPicked}
        />
      )}
    </div>
  );
};

interface TargetButtonProps {
  entry: ManifestEntry;
  active: boolean;
  disabled: boolean;
  onClick: (entry: ManifestEntry) => void;
}

const TargetButton: React.FC<TargetButtonProps> = ({
  entry,
  active,
  disabled,
  onClick,
}) => {
  const intl = useIntl();
  const manifest = useKorner(entry.slug);
  const KornerIcon = useKornerIcon(entry.slug);
  const label = manifest?.name ?? entry.slug;

  const handleClick = useCallback(() => {
    onClick(entry);
  }, [entry, onClick]);

  return (
    <button
      type='button'
      className={[
        'compose-attach-bar__target',
        active && 'compose-attach-bar__target--active',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={active}
      title={intl.formatMessage(messages.attach, { korner: label })}
    >
      <Icon id='add' icon={AddIcon} className='compose-attach-bar__plus' />
      <KornerIcon className='compose-attach-bar__target-icon' />
      <span>{label}</span>
    </button>
  );
};

interface PendingChipProps {
  pending: PendingAttachment;
  disabled: boolean;
  onRemove: (attachment: PendingAttachment) => void;
}

const PendingChip: React.FC<PendingChipProps> = ({
  pending,
  disabled,
  onRemove,
}) => {
  const intl = useIntl();
  const manifest = useKorner(pending.targetSlug);
  const KornerIcon = useKornerIcon(pending.targetSlug);
  const label = pending.title ?? manifest?.name ?? pending.targetSlug;

  const handleRemove = useCallback(() => {
    onRemove(pending);
  }, [onRemove, pending]);

  return (
    <li className='compose-attach-bar__chip'>
      <KornerIcon className='compose-attach-bar__chip-icon' />
      <span className='compose-attach-bar__chip-label'>{label}</span>
      <button
        type='button'
        className='compose-attach-bar__chip-remove'
        onClick={handleRemove}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.remove)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
    </li>
  );
};

// Small single-target picker — same search behaviour as the
// AttachmentSection's picker (spec §4.3), but scoped to one target
// slug and returning the picked row to the caller instead of writing
// a KornerAttachment. The compose bar collects intents; the composer
// commits them after the source record has an id.
interface ComposeAttachPickerProps {
  entry: ManifestEntry;
  onClose: () => void;
  onPicked: (row: AttachmentCandidateJSON) => void;
}

const ComposeAttachPicker: React.FC<ComposeAttachPickerProps> = ({
  entry,
  onClose,
  onPicked,
}) => {
  const intl = useIntl();
  const manifest = useKorner(entry.slug);
  const label = manifest?.name ?? entry.slug;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      apiSearchAttachmentCandidates(entry.slug, trimmed)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [entry.slug, query]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleBackdrop = useCallback(() => {
    onClose();
  }, [onClose]);

  return createPortal(
    <div
      className='attachment-picker'
      role='dialog'
      aria-modal='true'
      aria-labelledby='compose-attach-picker__title'
    >
      <button
        type='button'
        className='attachment-picker__backdrop'
        onClick={handleBackdrop}
        aria-label={intl.formatMessage(messages.cancel)}
      />
      <div className='attachment-picker__panel'>
        <header className='attachment-picker__header'>
          <h2
            id='compose-attach-picker__title'
            className='attachment-picker__title'
          >
            {intl.formatMessage(messages.attach, { korner: label })}
          </h2>
          <button
            type='button'
            className='attachment-picker__close'
            onClick={onClose}
            aria-label={intl.formatMessage(messages.cancel)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </header>

        <input
          ref={inputRef}
          className='attachment-picker__search'
          type='search'
          value={query}
          onChange={handleQueryChange}
          placeholder={intl.formatMessage(messages.searchPlaceholder, {
            korner: label,
          })}
        />

        <div className='attachment-picker__results' role='listbox'>
          {searching && (
            <p className='attachment-picker__status'>
              <FormattedMessage {...messages.searching} />
            </p>
          )}
          {!searching && results.length === 0 && (
            <p className='attachment-picker__status'>
              <FormattedMessage {...messages.noResults} />
            </p>
          )}
          {results.map((row) => (
            <PickerResultRow key={row.id} row={row} onPick={onPicked} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface PickerResultRowProps {
  row: AttachmentCandidateJSON;
  onPick: (row: AttachmentCandidateJSON) => void;
}

const PickerResultRow: React.FC<PickerResultRowProps> = ({ row, onPick }) => {
  const RowIcon = useKornerIcon(row.slug);
  const handleClick = useCallback(() => {
    onPick(row);
  }, [onPick, row]);

  return (
    <button
      type='button'
      className='attachment-picker__result'
      onClick={handleClick}
      role='option'
      aria-selected='false'
    >
      <RowIcon className='attachment-picker__result-icon' />
      <span className='attachment-picker__result-title'>
        {row.title ?? row.id}
      </span>
    </button>
  );
};
