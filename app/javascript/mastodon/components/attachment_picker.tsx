import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  AttachmentCandidateJSON,
  AttachmentKind,
} from 'mastodon/api/attachments';
import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { Icon } from 'mastodon/components/icon';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// The API refuses `spawn` on POST — narrow the picker's chosen kind
// so callers of `addLink` don't have to re-prove it at every use.
type PickerKind = Exclude<AttachmentKind, 'spawn'>;

// AttachmentPicker — the modal that lives behind the "Attach…" button
// on any detail page (docs/kronk_korner_attachments.md §4.3).
//
// Piggybacks on the ComposeShell / ConfirmDialog modal grammar:
// portal-mounted, backdrop click to cancel, Escape to cancel, focused
// panel with heading + body + footer. The panel itself is smaller than
// the compose shell because the flow is one-step (pick a target, pick
// a record) and doesn't need the full composer chrome.
//
// Reads the source manifest's `attaches:` list to know which target
// korners to offer. When the source hasn't opted in (no `attaches:`
// declared yet) the modal shows a "This korner cannot attach to
// anything yet" empty state, which is Phase 2's default before any
// korner has been migrated over — the primitive still ships useful.
//
// Kind is set to `link` today (user-added, independent lifecycle).
// A future update could read the manifest's `kind:` on each entry
// and offer per-target defaults; keeping it uniform for now to match
// Phase 3's Kalendar-first adoption.

const messages = defineMessages({
  heading: {
    id: 'attachment_picker.heading',
    defaultMessage: 'Attach something',
  },
  cancel: { id: 'attachment_picker.cancel', defaultMessage: 'Cancel' },
  searchPlaceholder: {
    id: 'attachment_picker.search_placeholder',
    defaultMessage: 'Search {korner}…',
  },
  targetLabel: {
    id: 'attachment_picker.target_label',
    defaultMessage: 'Attach to',
  },
  searching: {
    id: 'attachment_picker.searching',
    defaultMessage: 'Searching…',
  },
  noResults: {
    id: 'attachment_picker.no_results',
    defaultMessage: 'No matches.',
  },
  emptyManifest: {
    id: 'attachment_picker.empty_manifest',
    defaultMessage:
      'This korner cannot attach to anything yet. Declare an entry under `attaches:` in its manifest to enable attachment types.',
  },
  attachError: {
    id: 'attachment_picker.attach_error',
    defaultMessage: 'Could not attach — {message}.',
  },
});

interface AttachmentPickerProps {
  sourceSlug: string;
  sourceId: string | number;
  onClose: () => void;
  onAttached?: () => void;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  sourceSlug,
  sourceId,
  onClose,
  onAttached,
}) => {
  const intl = useIntl();
  const sourceManifest = useKorner(sourceSlug);
  const { addLink } = useAttachments(sourceSlug, sourceId);

  // Deduplicate the (target_slug, kind) pairs the source manifest permits.
  // A source can declare the same target with different kinds — we render
  // each unique target once and default the kind to `link` (spec §4.3).
  const targetSlugs = useMemo(() => {
    const raw = sourceManifest?.attaches ?? [];
    const uniques: { slug: string; kind: PickerKind }[] = [];
    const seen = new Set<string>();
    raw.forEach((entry) => {
      if (entry.to === '*') return;
      if (seen.has(entry.to)) return;
      seen.add(entry.to);
      // Prefer a `link` entry when the manifest declares one; otherwise
      // fall back to the entry's own kind. `spawn` is stripped because
      // the API refuses user-initiated spawn attachments.
      const linkEntry = raw.find((e) => e.to === entry.to && e.kind === 'link');
      const kind = linkEntry?.kind ?? entry.kind;
      if (kind === 'spawn') return;
      seen.add(entry.to);
      uniques.push({ slug: entry.to, kind: kind as PickerKind });
    });
    return uniques;
  }, [sourceManifest?.attaches]);

  const [target, setTarget] = useState<
    { slug: string; kind: PickerKind } | undefined
  >(() => targetSlugs[0]);
  // Track when targetSlugs changes (async manifest load) so we pick a
  // valid default. Otherwise the initial [] locks the state to undefined.
  useEffect(() => {
    if (!target && targetSlugs.length > 0) setTarget(targetSlugs[0]);
  }, [target, targetSlugs]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search input on mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !attaching) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [attaching, onClose]);

  // Debounced search — matches the hand-rolled setTimeout pattern used
  // by event_composer.tsx' invitee search.
  useEffect(() => {
    if (!target) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const trimmed = query.trim();
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      apiSearchAttachmentCandidates(target.slug, trimmed)
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
  }, [target, query]);

  const handleAttach = useCallback(
    async (row: AttachmentCandidateJSON) => {
      if (!target || attaching) return;
      setAttaching(true);
      setError(null);
      try {
        await addLink(target.slug, row.id, target.kind);
        onAttached?.();
        onClose();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'unknown error';
        setError(intl.formatMessage(messages.attachError, { message }));
        setAttaching(false);
      }
    },
    [addLink, attaching, intl, onAttached, onClose, target],
  );

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleBackdrop = useCallback(() => {
    if (!attaching) onClose();
  }, [attaching, onClose]);

  return createPortal(
    <div
      className='attachment-picker'
      role='dialog'
      aria-modal='true'
      aria-labelledby='attachment-picker__heading'
    >
      <button
        type='button'
        className='attachment-picker__backdrop'
        onClick={handleBackdrop}
        aria-label={intl.formatMessage(messages.cancel)}
        disabled={attaching}
      />
      <div className='attachment-picker__panel'>
        <header className='attachment-picker__header'>
          <h2
            id='attachment-picker__heading'
            className='attachment-picker__title'
          >
            {intl.formatMessage(messages.heading)}
          </h2>
          <button
            type='button'
            className='attachment-picker__close'
            onClick={onClose}
            disabled={attaching}
            aria-label={intl.formatMessage(messages.cancel)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </header>

        {targetSlugs.length === 0 ? (
          <p className='attachment-picker__empty'>
            {intl.formatMessage(messages.emptyManifest)}
          </p>
        ) : (
          <>
            {targetSlugs.length > 1 ? (
              <div className='attachment-picker__target-pills'>
                {targetSlugs.map((t) => (
                  <TargetPill
                    key={t.slug}
                    slug={t.slug}
                    active={target?.slug === t.slug}
                    disabled={attaching}
                    onSelect={setTarget}
                    kind={t.kind}
                  />
                ))}
              </div>
            ) : (
              target && (
                <TargetChip
                  slug={target.slug}
                  label={intl.formatMessage(messages.targetLabel)}
                />
              )
            )}

            <input
              ref={inputRef}
              className='attachment-picker__search'
              type='search'
              value={query}
              onChange={handleQueryChange}
              disabled={attaching}
              placeholder={intl.formatMessage(messages.searchPlaceholder, {
                korner: target?.slug ?? '',
              })}
            />

            <div className='attachment-picker__results'>
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
                <CandidateRow
                  key={row.id}
                  row={row}
                  disabled={attaching}
                  onAttach={handleAttach}
                />
              ))}
            </div>

            {error && (
              <p className='attachment-picker__error' role='alert'>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

// Single-target header chip. Reads as "you're attaching an X" without
// forcing a native <select> onto the surface when there's only one
// target to choose from.
const TargetChip: React.FC<{ slug: string; label: string }> = ({
  slug,
  label,
}) => {
  const manifest = useKorner(slug);
  const Icon = useKornerIcon(slug);
  return (
    <div className='attachment-picker__target-chip'>
      <span className='attachment-picker__target-chip__label'>{label}</span>
      <span className='attachment-picker__target-chip__body'>
        <Icon className='attachment-picker__target-chip__icon' />
        <span className='attachment-picker__target-chip__name'>
          {manifest?.name ?? slug}
        </span>
      </span>
    </div>
  );
};

// Multi-target segmented pill. Kronk-purple wash when selected; icon +
// korner name on each pill.
interface TargetPillProps {
  slug: string;
  kind: PickerKind;
  active: boolean;
  disabled: boolean;
  onSelect: (target: { slug: string; kind: PickerKind }) => void;
}

const TargetPill: React.FC<TargetPillProps> = ({
  slug,
  kind,
  active,
  disabled,
  onSelect,
}) => {
  const manifest = useKorner(slug);
  const Icon = useKornerIcon(slug);
  const handleClick = useCallback(() => {
    onSelect({ slug, kind });
  }, [onSelect, slug, kind]);
  return (
    <button
      type='button'
      className={`attachment-picker__target-pill${active ? ' attachment-picker__target-pill--active' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <Icon className='attachment-picker__target-pill__icon' />
      <span>{manifest?.name ?? slug}</span>
    </button>
  );
};

interface CandidateRowProps {
  row: AttachmentCandidateJSON;
  disabled: boolean;
  onAttach: (row: AttachmentCandidateJSON) => Promise<void>;
}

const CandidateRow: React.FC<CandidateRowProps> = ({
  row,
  disabled,
  onAttach,
}) => {
  const TargetIcon = useKornerIcon(row.slug);
  const handleClick = useCallback(() => {
    void onAttach(row);
  }, [onAttach, row]);

  return (
    <button
      type='button'
      className='attachment-picker__result'
      onClick={handleClick}
      disabled={disabled}
    >
      <TargetIcon className='attachment-picker__result-icon' />
      <span className='attachment-picker__result-title'>
        {row.title ?? row.id}
      </span>
    </button>
  );
};
