import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import LinkIcon from '@/material-icons/400-24px/link.svg?react';
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
  const [konnectOpen, setKonnectOpen] = useState(false);

  // Wrap in useMemo so the two downstream `useMemo`s below don't see
  // a fresh `[]` on every render (React would then recompute their
  // deps unnecessarily and eslint would rightly warn).
  const attachEntries = useMemo(
    () => sourceManifest?.attaches ?? [],
    [sourceManifest?.attaches],
  );

  // Spawn entries with a `field:<name>` trigger — each renders as its
  // own toggle button (compose picks it up as `spawn_album: true`
  // etc.). Wildcard spawns aren't a thing today, so specific-only.
  const spawnEntries = useMemo<SpawnEntry[]>(() => {
    return attachEntries.flatMap((entry) => {
      if (entry.to === '*') return [];
      if (entry.kind !== 'spawn') return [];
      const trigger = entry.trigger ?? '';
      if (!trigger.startsWith('field:')) return [];
      return [{ slug: entry.to, triggerField: trigger.slice('field:'.length) }];
    });
  }, [attachEntries]);

  // Every korner the source may link to. If the source has a wildcard
  // `attaches: [{to: '*', kind: 'link'}]`, walk every registered
  // manifest and keep those that `accept` from this source (either
  // specifically or via `from: '*'`). Without a wildcard, fall back
  // to the explicit `link` targets the source declared.
  const linkTargets = useMemo<string[]>(() => {
    const hasWildcardLink = attachEntries.some(
      (e) => e.to === '*' && e.kind === 'link',
    );

    if (hasWildcardLink) {
      const consenting = allKorners
        .filter((k) => {
          if (k.slug === sourceSlug) return false; // don't self-link
          const accepts = k.accepts ?? [];
          return accepts.some(
            (a) =>
              a.kind === 'link' && (a.from === '*' || a.from === sourceSlug),
          );
        })
        .map((k) => k.slug);
      return Array.from(new Set(consenting));
    }

    return Array.from(
      new Set(
        attachEntries
          .filter((e) => e.kind === 'link' && e.to !== '*')
          .map((e) => e.to),
      ),
    );
  }, [attachEntries, allKorners, sourceSlug]);

  const handleSpawnClick = useCallback(
    (entry: SpawnEntry) => {
      if (disabled) return;
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
    },
    [disabled, onAdd, onRemove, pending],
  );

  const openKonnect = useCallback(() => {
    if (disabled) return;
    setKonnectOpen(true);
  }, [disabled]);
  const closeKonnect = useCallback(() => {
    setKonnectOpen(false);
  }, []);

  const handleKonnectPicked = useCallback(
    (targetSlug: string, row: AttachmentCandidateJSON) => {
      onAdd({
        targetSlug,
        targetId: row.id,
        kind: 'link',
        title: row.title ?? undefined,
      });
      setKonnectOpen(false);
    },
    [onAdd],
  );

  const anythingToShow = spawnEntries.length > 0 || linkTargets.length > 0;
  if (!anythingToShow) return null;

  return (
    <div className='compose-attach-bar'>
      <div className='compose-attach-bar__buttons' role='toolbar'>
        {spawnEntries.map((entry) => (
          <SpawnButton
            key={entry.slug}
            entry={entry}
            active={pending.some(
              (p) =>
                p.targetSlug === entry.slug &&
                p.kind === 'spawn' &&
                p.targetId === undefined,
            )}
            disabled={disabled}
            onClick={handleSpawnClick}
          />
        ))}

        {linkTargets.length > 0 && (
          <button
            type='button'
            className='compose-attach-bar__konnect'
            onClick={openKonnect}
            disabled={disabled}
            title={intl2(messages.konnectHint)}
          >
            <Icon
              id='link'
              icon={LinkIcon}
              className='compose-attach-bar__plus'
            />
            <span>
              <FormattedMessage {...messages.konnect} />
            </span>
          </button>
        )}
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

      {konnectOpen && (
        <KonnectPickerModal
          targetSlugs={linkTargets}
          onClose={closeKonnect}
          onPicked={handleKonnectPicked}
        />
      )}
    </div>
  );
};

// Small helper — react-intl needs an intl instance for
// `formatMessage`, and we don't have one at the button title level
// without hooking it. Falls back to defaultMessage which is fine
// for a title attribute (no interpolation needed).
function intl2(desc: { defaultMessage: string }): string {
  return desc.defaultMessage;
}

interface SpawnButtonProps {
  entry: SpawnEntry;
  active: boolean;
  disabled: boolean;
  onClick: (entry: SpawnEntry) => void;
}

const SpawnButton: React.FC<SpawnButtonProps> = ({
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

// KonnectPickerModal — two-step picker. Step 1: pick a target
// korner from the list of consenting korners (skipped when there's
// only one, since the choice is made). Step 2: search records
// within the picked korner and pick one. Returns to the parent via
// onPicked(targetSlug, row).
interface KonnectPickerModalProps {
  targetSlugs: string[];
  onClose: () => void;
  onPicked: (targetSlug: string, row: AttachmentCandidateJSON) => void;
}

const KonnectPickerModal: React.FC<KonnectPickerModalProps> = ({
  targetSlugs,
  onClose,
  onPicked,
}) => {
  const intl = useIntl();
  const [chosenSlug, setChosenSlug] = useState<string | null>(
    targetSlugs.length === 1 ? (targetSlugs[0] ?? null) : null,
  );

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

  const handleBack = useCallback(() => {
    setChosenSlug(null);
  }, []);

  const handleSearchPicked = useCallback(
    (row: AttachmentCandidateJSON) => {
      if (chosenSlug) onPicked(chosenSlug, row);
    },
    [chosenSlug, onPicked],
  );

  return createPortal(
    <div
      className='attachment-picker'
      role='dialog'
      aria-modal='true'
      aria-labelledby='konnect-picker__title'
    >
      <button
        type='button'
        className='attachment-picker__backdrop'
        onClick={handleBackdrop}
        aria-label={intl.formatMessage(messages.cancel)}
      />
      <div className='attachment-picker__panel'>
        <header className='attachment-picker__header'>
          <h2 id='konnect-picker__title' className='attachment-picker__title'>
            {chosenSlug
              ? intl.formatMessage(messages.attach, {
                  korner:
                    targetSlugs.length > 1
                      ? intl.formatMessage(messages.konnect)
                      : '',
                })
              : intl.formatMessage(messages.pickKornerHeading)}
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

        {chosenSlug === null ? (
          <KornerGrid targetSlugs={targetSlugs} onPick={setChosenSlug} />
        ) : (
          <>
            {targetSlugs.length > 1 && (
              <button
                type='button'
                className='attachment-picker__back'
                onClick={handleBack}
              >
                ← {intl.formatMessage(messages.backToKorners)}
              </button>
            )}
            <SearchWithinKorner
              targetSlug={chosenSlug}
              onPicked={handleSearchPicked}
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const KornerGrid: React.FC<{
  targetSlugs: string[];
  onPick: (slug: string) => void;
}> = ({ targetSlugs, onPick }) => (
  <div className='attachment-picker__korners' role='listbox'>
    {targetSlugs.map((slug) => (
      <KornerGridButton key={slug} slug={slug} onPick={onPick} />
    ))}
  </div>
);

const KornerGridButton: React.FC<{
  slug: string;
  onPick: (slug: string) => void;
}> = ({ slug, onPick }) => {
  const manifest = useKorner(slug);
  const KornerIcon = useKornerIcon(slug);
  const handleClick = useCallback(() => {
    onPick(slug);
  }, [onPick, slug]);
  return (
    <button
      type='button'
      className='attachment-picker__korner'
      onClick={handleClick}
    >
      <KornerIcon className='attachment-picker__korner-icon' />
      <span>{manifest?.name ?? slug}</span>
    </button>
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
