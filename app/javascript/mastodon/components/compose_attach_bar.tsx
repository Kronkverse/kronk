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
import { useAllKorners, useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// ComposeAttachBar — the compose-time attach surface. Two groups of
// affordances:
//
//   * per-spawn toggle — one button per manifest entry with
//     `{kind: spawn, trigger: field:<name>}`. Tap toggles the intent;
//     the parent composer collapses these into the record's own
//     field (e.g. `spawn_album: true` on the create payload) so
//     `Kronk::AttachmentSource#fire_kronk_spawn_attachments` fires
//     the registered factory + writes the join row after
//     create_commit. Second tap removes.
//   * Konnect a korner — one universal button that covers every
//     `link`-kind entry the source declares. When a wildcard
//     `attaches: [{to: '*', kind: 'link'}]` is present, the picker
//     lists every target korner that accepts (specifically or via
//     `accepts: [{from: '*'}]`). Without a wildcard, only the
//     explicit `link` targets show up.
//
// The picker returns { targetSlug, targetId, title } which the
// parent composer commits after the source record's id is known —
// one POST /api/v1/attachments per pending link row.
//
// Reference-kind entries are ignored (passive mention pattern, not
// user-driven).

const messages = defineMessages({
  attach: {
    id: 'compose_attach_bar.attach',
    defaultMessage: 'Attach {korner}',
  },
  konnect: {
    id: 'compose_attach_bar.konnect',
    defaultMessage: 'Konnect a korner',
  },
  konnectHint: {
    id: 'compose_attach_bar.konnect_hint',
    defaultMessage: 'Link a specific thing from another space.',
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
  pickKornerHeading: {
    id: 'compose_attach_bar.pick_korner',
    defaultMessage: 'Which space?',
  },
  backToKorners: {
    id: 'compose_attach_bar.back_to_korners',
    defaultMessage: 'Back',
  },
});

type PendingKind = AttachmentKind;

export interface PendingAttachment {
  targetSlug: string;
  targetId?: string; // undefined for spawn/field triggers
  kind: PendingKind;
  title?: string; // chip label for link picks; undefined for spawn
}

interface SpawnEntry {
  slug: string;
  triggerField: string;
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
  const allKorners = useAllKorners();
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // Wrap in useMemo so downstream memos don't see a fresh `[]` on
  // every render.
  const attachEntries = useMemo(
    () => sourceManifest?.attaches ?? [],
    [sourceManifest?.attaches],
  );

  // Spawn-field entries indexed by target slug — used when opening a
  // korner picker to offer a "Create new …" option alongside the
  // usual search results. Only field-triggered spawns surface here;
  // `event:` triggers stay framework-internal.
  const spawnEntriesByTarget = useMemo(() => {
    const map = new Map<string, SpawnEntry>();
    attachEntries.forEach((entry) => {
      if (entry.to === '*') return;
      if (entry.kind !== 'spawn') return;
      const trigger = entry.trigger ?? '';
      if (!trigger.startsWith('field:')) return;
      map.set(entry.to, {
        slug: entry.to,
        triggerField: trigger.slice('field:'.length),
      });
    });
    return map;
  }, [attachEntries]);

  // Every korner the source may reach. Union of:
  //   * explicit link targets in the source manifest's `attaches:`
  //   * every korner accepting from us (specific or `from: '*'`)
  //     when the source declares a wildcard link (`to: '*'`)
  //   * every spawn/field target (Albutts today) — they're a
  //     "create new" affordance the picker handles inside its
  //     modal
  const targetSlugs = useMemo<string[]>(() => {
    const set = new Set<string>();

    attachEntries.forEach((entry) => {
      if (entry.to === '*') return;
      if (entry.kind === 'reference') return;
      set.add(entry.to);
    });

    const hasWildcardLink = attachEntries.some(
      (e) => e.to === '*' && e.kind === 'link',
    );
    if (hasWildcardLink) {
      allKorners.forEach((k) => {
        if (k.slug === sourceSlug) return;
        const accepts = k.accepts ?? [];
        const acceptsUs = accepts.some(
          (a) => a.kind === 'link' && (a.from === '*' || a.from === sourceSlug),
        );
        if (acceptsUs) set.add(k.slug);
      });
    }

    return Array.from(set);
  }, [attachEntries, allKorners, sourceSlug]);

  const openPicker = useCallback(
    (slug: string) => {
      if (disabled) return;
      setPickerFor(slug);
    },
    [disabled],
  );
  const closePicker = useCallback(() => {
    setPickerFor(null);
  }, []);

  const handleLinkPicked = useCallback(
    (row: AttachmentCandidateJSON) => {
      if (!pickerFor) return;
      onAdd({
        targetSlug: pickerFor,
        targetId: row.id,
        kind: 'link',
        title: row.title ?? undefined,
      });
      setPickerFor(null);
    },
    [onAdd, pickerFor],
  );

  const handleSpawnPicked = useCallback(
    (targetSlug: string) => {
      const existing = pending.find(
        (p) =>
          p.targetSlug === targetSlug &&
          p.kind === 'spawn' &&
          p.targetId === undefined,
      );
      if (existing) {
        onRemove(existing);
      } else {
        onAdd({ targetSlug, kind: 'spawn' });
      }
      setPickerFor(null);
    },
    [onAdd, onRemove, pending],
  );

  if (targetSlugs.length === 0) return null;

  const spawnForPicker = pickerFor
    ? spawnEntriesByTarget.get(pickerFor)
    : undefined;

  return (
    <div className='compose-attach-bar'>
      <div className='compose-attach-bar__buttons' role='toolbar'>
        {targetSlugs.map((slug) => (
          <KornerOptionButton
            key={slug}
            slug={slug}
            hasPendingSpawn={pending.some(
              (p) =>
                p.targetSlug === slug &&
                p.kind === 'spawn' &&
                p.targetId === undefined,
            )}
            disabled={disabled}
            onClick={openPicker}
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
        <SingleKornerPickerModal
          targetSlug={pickerFor}
          spawnEntry={spawnForPicker}
          spawnAlreadyPending={pending.some(
            (p) =>
              p.targetSlug === pickerFor &&
              p.kind === 'spawn' &&
              p.targetId === undefined,
          )}
          onClose={closePicker}
          onLinkPicked={handleLinkPicked}
          onSpawnPicked={handleSpawnPicked}
        />
      )}
    </div>
  );
};

interface KornerOptionButtonProps {
  slug: string;
  hasPendingSpawn: boolean;
  disabled: boolean;
  onClick: (slug: string) => void;
}

const KornerOptionButton: React.FC<KornerOptionButtonProps> = ({
  slug,
  hasPendingSpawn,
  disabled,
  onClick,
}) => {
  const intl = useIntl();
  const manifest = useKorner(slug);
  const KornerIcon = useKornerIcon(slug);
  const label = manifest?.name ?? slug;

  const handleClick = useCallback(() => {
    onClick(slug);
  }, [onClick, slug]);

  return (
    <button
      type='button'
      className={[
        'compose-attach-bar__target',
        hasPendingSpawn && 'compose-attach-bar__target--active',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      disabled={disabled}
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

// KonnectPickerModal — two-step picker. Step 1: pick a target
// korner from the list of consenting korners (skipped when there's
// only one, since the choice is made). Step 2: search records
// within the picked korner and pick one. Returns to the parent via
// onPicked(targetSlug, row).
interface KonnectPickerModalProps {
  targetSlug: string;
  spawnEntry?: SpawnEntry;
  spawnAlreadyPending: boolean;
  onClose: () => void;
  onLinkPicked: (row: AttachmentCandidateJSON) => void;
  onSpawnPicked: (targetSlug: string) => void;
}

const SingleKornerPickerModal: React.FC<KonnectPickerModalProps> = ({
  targetSlug,
  spawnEntry,
  spawnAlreadyPending,
  onClose,
  onLinkPicked,
  onSpawnPicked,
}) => {
  const intl = useIntl();
  const manifest = useKorner(targetSlug);
  const label = manifest?.name ?? targetSlug;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleBackdrop = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSpawn = useCallback(() => {
    onSpawnPicked(targetSlug);
  }, [onSpawnPicked, targetSlug]);

  return createPortal(
    <div
      className='attachment-picker'
      role='dialog'
      aria-modal='true'
      aria-labelledby='single-korner-picker__title'
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
            id='single-korner-picker__title'
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

        {spawnEntry && (
          <button
            type='button'
            className={[
              'attachment-picker__spawn',
              spawnAlreadyPending && 'attachment-picker__spawn--active',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={handleSpawn}
          >
            <Icon id='add' icon={AddIcon} className='attachment-picker__plus' />
            <span>
              {spawnAlreadyPending ? (
                <FormattedMessage
                  id='compose_attach_bar.spawn_pending'
                  defaultMessage='Companion {korner} — will be created'
                  values={{ korner: label }}
                />
              ) : (
                <FormattedMessage
                  id='compose_attach_bar.spawn_new'
                  defaultMessage='Create a new companion {korner}'
                  values={{ korner: label }}
                />
              )}
            </span>
          </button>
        )}

        <SearchWithinKorner targetSlug={targetSlug} onPicked={onLinkPicked} />
      </div>
    </div>,
    document.body,
  );
};

const SearchWithinKorner: React.FC<{
  targetSlug: string;
  onPicked: (row: AttachmentCandidateJSON) => void;
}> = ({ targetSlug, onPicked }) => {
  const intl = useIntl();
  const manifest = useKorner(targetSlug);
  const label = manifest?.name ?? targetSlug;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [targetSlug]);

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      apiSearchAttachmentCandidates(targetSlug, trimmed)
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
  }, [targetSlug, query]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  return (
    <>
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
    </>
  );
};

const PickerResultRow: React.FC<{
  row: AttachmentCandidateJSON;
  onPick: (row: AttachmentCandidateJSON) => void;
}> = ({ row, onPick }) => {
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
