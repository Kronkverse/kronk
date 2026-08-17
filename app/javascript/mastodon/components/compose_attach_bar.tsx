import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import Overlay from 'react-overlays/Overlay';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import UnfoldMoreIcon from '@/material-icons/400-24px/unfold_more.svg?react';
import type { AttachmentCandidateJSON } from 'mastodon/api/attachments';
import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { matchWidth } from 'mastodon/components/dropdown/utils';
import type { IconProp } from 'mastodon/components/icon';
import { Icon } from 'mastodon/components/icon';
import { useAllKorners, useKorner } from 'mastodon/hooks/useKorner';
import { kornerIcon, useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// ComposeAttachBar — the compose-time "Konnect a korner" surface.
//
// A multi-select picker at the top lets the user pick any number of
// target korners the source manifest reaches (specific link entries
// plus every korner accepting from a wildcard `attaches: [{to: '*'}]`).
// The picker is a Kronk-styled popover: each row shows the korner's
// icon, name, and a short description, with a check mark on picks
// that already have a section below. Clicking a row toggles — pick
// to add, click again to remove. The popover stays open on pick so
// the user can build up several connections in one gesture (Tal
// 2026-08-16 — "instead one selecting one by one, can it be
// multiple select?").
//
// Each pick lands as its own inline section stacked in the composer
// body. Sections come in two shapes:
//
//   * create-new — the target korner is created inline. Today:
//       - Albutts: mini-form (title + optional cover_media_attachment_id)
//       - Huddle:  mini-form (title)
//     On submit the parent walks each create-new connection, POSTs
//     the target korner's own create endpoint, then POSTs
//     `/api/v1/attachments` binding it to the source event.
//   * link — search the target korner's own records and pick one.
//     On submit the parent POSTs `/api/v1/attachments` with the
//     source event id + picked target id.
//
// Reach follows the source strictly: an Albutts album spawned here
// inherits the event's visibility (Tal 2026-08-16 — "if it's a
// public event, the korner connects should be public"). The parent
// composer passes the event's `visibility` down so the create
// payload carries it.
//
// Reference-kind entries stay framework-internal (no UI).

const messages = defineMessages({
  addPlaceholder: {
    id: 'compose_attach_bar.add_placeholder',
    defaultMessage: 'Select a space to connect…',
  },
  triggerLabel: {
    id: 'compose_attach_bar.trigger',
    defaultMessage: 'Choose spaces to connect…',
  },
  remove: {
    id: 'compose_attach_bar.remove',
    defaultMessage: 'Remove connection',
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
  albumTitleLabel: {
    id: 'compose_attach_bar.album_title',
    defaultMessage: 'Album title (optional)',
  },
  albumTitleHint: {
    id: 'compose_attach_bar.album_title_hint',
    defaultMessage: "Leave blank to reuse the event's title.",
  },
  albumCoverLabel: {
    id: 'compose_attach_bar.album_cover',
    defaultMessage: 'Cover image (optional)',
  },
  huddleTitleLabel: {
    id: 'compose_attach_bar.huddle_title',
    defaultMessage: 'Huddle title (optional)',
  },
  huddleTitleHint: {
    id: 'compose_attach_bar.huddle_title_hint',
    defaultMessage: "Leave blank to reuse the event's title.",
  },
  pickedTitle: {
    id: 'compose_attach_bar.picked_title',
    defaultMessage: 'Picked: {title}',
  },
  changePick: {
    id: 'compose_attach_bar.change_pick',
    defaultMessage: 'Change',
  },
});

// Per-korner one-liner shown under the name in the picker. Slugs
// missing from this map fall back to no description (bare name
// only). Kept as a plain lookup so translators can localise each
// line independently; korners that don't belong in this surface
// (Kommons, Krew — see EXCLUDED_KORNERS) don't need an entry.
const descriptionMessages = defineMessages({
  albutts: {
    id: 'compose_attach_bar.desc.albutts',
    defaultMessage: 'Add an event album',
  },
  huddle: {
    id: 'compose_attach_bar.desc.huddle',
    defaultMessage: 'Meet online',
  },
  art: {
    id: 'compose_attach_bar.desc.art',
    defaultMessage: 'Connect creation',
  },
  martketplace: {
    id: 'compose_attach_bar.desc.martketplace',
    defaultMessage: 'Connect to the martket',
  },
});

// Korners that only make sense to *create new* through this surface
// (spawn semantics — the target IS this event's Album / Huddle). All
// others are link-only for now. A single global list keeps the
// per-korner section renderer switch tiny and predictable; if the
// list grows, promote to a manifest field.
const CREATE_ONLY_KORNERS = new Set(['albutts', 'huddle']);

// Slugs never surfaced in the Konnect picker:
//   * Kommons — has its own governance flow; proposals aren't
//     per-event artefacts.
//   * Krew — visibility is an audience choice; it lives in the
//     reach/scope picker, not the attach flow (Tal 2026-08-16).
//   * Kuestions — kept off the compose-time attach surface for
//     now (Tal 2026-08-17); Q&A around an event is better
//     initiated from the event detail page than pre-committed
//     as a connection.
const EXCLUDED_KORNERS = new Set(['kommons', 'krew', 'kuestions']);

interface KornerPick {
  slug: string;
  label: string;
  description?: string;
  IconComponent: IconProp;
}

type ConnectionMode = 'create' | 'link';

// Per-connection state. `id` is a client-generated stable key for
// React reconciliation + update paths; every field except id is
// user-mutable while the connection is in draft.
export interface PendingConnection {
  id: string;
  targetSlug: string;
  mode: ConnectionMode;

  // create mode — the two fields on the mini-form. Both optional;
  // server-side fallback is the event's own title / cover.
  createTitle?: string;
  createCoverId?: string; // media_attachment id, uploaded via /api/v2/media
  createCoverPreviewUrl?: string;

  // link mode — the target record already picked (undefined until
  // the user clicks a search result).
  linkTargetId?: string;
  linkTitle?: string;
}

interface ComposeAttachBarProps {
  sourceSlug: string;
  connections: PendingConnection[];
  onAdd: (connection: PendingConnection) => void;
  onUpdate: (id: string, patch: Partial<PendingConnection>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

let nextConnectionCounter = 0;
const newConnectionId = () => `cx-${++nextConnectionCounter}`;

export const ComposeAttachBar: React.FC<ComposeAttachBarProps> = ({
  sourceSlug,
  connections,
  onAdd,
  onUpdate,
  onRemove,
  disabled = false,
}) => {
  const intl = useIntl();
  const sourceManifest = useKorner(sourceSlug);
  const allKorners = useAllKorners();
  const dropdownLabelId = useId();

  const attachEntries = useMemo(
    () => sourceManifest?.attaches ?? [],
    [sourceManifest?.attaches],
  );

  // Build the list of korners the source can attach to. Direct
  // `attaches:` entries first, then every korner accepting from a
  // wildcard `attaches: [{to: '*'}]`. `EXCLUDED_KORNERS` filters
  // out slugs that don't belong here (Kommons, Krew). Uses the
  // non-hook `kornerIcon(slug, manifest)` variant so we can resolve
  // one icon per iteration without hitting the Rules of Hooks.
  const picks = useMemo<KornerPick[]>(() => {
    const bySlug = new Map(allKorners.map((k) => [k.slug, k]));
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

    return Array.from(set)
      .filter((slug) => !EXCLUDED_KORNERS.has(slug))
      .map<KornerPick>((slug) => {
        const manifest = bySlug.get(slug);
        // `slug in ...` narrows to a known key so the lookup is
        // typed as a definite MessageDescriptor; without the
        // guard, the cast lies and eslint's
        // `no-unnecessary-condition` flags the `?` below.
        const descMsg =
          slug in descriptionMessages
            ? descriptionMessages[slug as keyof typeof descriptionMessages]
            : undefined;
        return {
          slug,
          label: manifest?.name ?? slug,
          description: descMsg ? intl.formatMessage(descMsg) : undefined,
          IconComponent: kornerIcon(slug, manifest),
        };
      });
  }, [attachEntries, allKorners, sourceSlug, intl]);

  // O(1) lookup for "is this slug already picked" in the picker's
  // per-row check-indicator render. Built from the parent's
  // connections list so the picker reflects state without threading
  // extra selection state through the tree.
  const pickedSlugs = useMemo(
    () => new Set(connections.map((c) => c.targetSlug)),
    [connections],
  );

  // Toggle: click a picker row → add a pending connection if the
  // slug isn't picked; otherwise remove the matching connection.
  // Same handler backs Enter/Space keyboard activation on the row.
  const handleToggle = useCallback(
    (slug: string) => {
      const existing = connections.find((c) => c.targetSlug === slug);
      if (existing) {
        onRemove(existing.id);
        return;
      }
      const mode: ConnectionMode = CREATE_ONLY_KORNERS.has(slug)
        ? 'create'
        : 'link';
      onAdd({ id: newConnectionId(), targetSlug: slug, mode });
    },
    [connections, onAdd, onRemove],
  );

  if (picks.length === 0) return null;

  return (
    <div className='compose-attach-bar'>
      <label
        id={dropdownLabelId}
        htmlFor={`${dropdownLabelId}-button`}
        className='compose-attach-bar__dropdown-label'
      >
        {intl.formatMessage(messages.addPlaceholder)}
      </label>
      <KornerMultiPicker
        picks={picks}
        pickedSlugs={pickedSlugs}
        onToggle={handleToggle}
        labelId={dropdownLabelId}
        buttonId={`${dropdownLabelId}-button`}
        triggerLabel={intl.formatMessage(messages.triggerLabel)}
        disabled={disabled}
      />

      {connections.length > 0 && (
        <ul className='compose-attach-bar__sections'>
          {connections.map((conn) => (
            <ConnectionSection
              key={conn.id}
              connection={conn}
              disabled={disabled}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

// Kronk-styled multi-select picker used only by ComposeAttachBar.
// Not promoted to a shared primitive yet — every other Kronk
// `<Dropdown>` consumer is single-select, so keep this local until
// a second surface actually needs the same shape.
//
// Aesthetic: reuses `.visibility-dropdown__button`,
// `.visibility-dropdown__overlay`, `.visibility-dropdown__dropdown`
// and `.visibility-dropdown__option` classes verbatim — the
// popover looks and behaves like the shared Kronk dropdown,
// including the z-index-99999 lift shipped in #1553 so the popover
// paints above `<ComposeShell>`.
//
// Multi-select: unlike `<DropdownSelector>` (which fires `onClose`
// on every option click), this picker calls `onToggle` on click
// and leaves the popover open, so the user can build several
// picks in one open (close by clicking outside or Escape).
interface KornerMultiPickerProps {
  picks: KornerPick[];
  pickedSlugs: Set<string>;
  onToggle: (slug: string) => void;
  labelId: string;
  buttonId: string;
  triggerLabel: string;
  disabled?: boolean;
}

const KornerMultiPicker: React.FC<KornerMultiPickerProps> = ({
  picks,
  pickedSlugs,
  onToggle,
  labelId,
  buttonId,
  triggerLabel,
  disabled = false,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) setOpen((o) => !o);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLLIElement>) => {
      e.preventDefault();
      const slug = e.currentTarget.dataset.slug;
      if (slug) onToggle(slug);
    },
    [onToggle],
  );

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLLIElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const slug = e.currentTarget.dataset.slug;
        if (slug) onToggle(slug);
      } else if (e.key === 'Escape') {
        handleClose();
        buttonRef.current?.focus();
      }
    },
    [onToggle, handleClose],
  );

  return (
    <>
      <button
        type='button'
        id={buttonId}
        aria-labelledby={`${labelId} ${buttonId}`}
        aria-expanded={open}
        aria-haspopup='listbox'
        onClick={handleTriggerClick}
        disabled={disabled}
        ref={buttonRef}
        className={classNames('visibility-dropdown__button', {
          active: open,
        })}
      >
        {triggerLabel}
        <Icon
          id='unfold-more'
          icon={UnfoldMoreIcon}
          className='visibility-dropdown__icon'
        />
      </button>
      <Overlay
        show={open}
        placement='bottom-start'
        onHide={handleClose}
        rootClose
        flip
        target={buttonRef.current}
        popperConfig={{ strategy: 'fixed', modifiers: [matchWidth] }}
      >
        {({ props, placement }) => (
          <div {...props} className='visibility-dropdown__overlay'>
            <div
              className={classNames(
                'dropdown-animation',
                'visibility-dropdown__dropdown',
                placement,
              )}
            >
              <ul role='listbox' aria-multiselectable='true'>
                {picks.map((p) => {
                  const picked = pickedSlugs.has(p.slug);
                  return (
                    <li
                      key={p.slug}
                      data-slug={p.slug}
                      role='option'
                      tabIndex={0}
                      aria-selected={picked}
                      onClick={handleRowClick}
                      onKeyDown={handleRowKeyDown}
                      className={classNames('visibility-dropdown__option', {
                        active: picked,
                      })}
                    >
                      <div className='visibility-dropdown__option__icon'>
                        <Icon id={`korner-${p.slug}`} icon={p.IconComponent} />
                      </div>
                      <div className='visibility-dropdown__option__content'>
                        <strong>{p.label}</strong>
                        {p.description}
                      </div>
                      {picked && (
                        <div
                          className='visibility-dropdown__option__check'
                          aria-hidden='true'
                        >
                          <Icon id='check' icon={CheckIcon} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </Overlay>
    </>
  );
};

interface ConnectionSectionProps {
  connection: PendingConnection;
  disabled: boolean;
  onUpdate: (id: string, patch: Partial<PendingConnection>) => void;
  onRemove: (id: string) => void;
}

const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  connection,
  disabled,
  onUpdate,
  onRemove,
}) => {
  const intl = useIntl();
  const manifest = useKorner(connection.targetSlug);
  const KornerIcon = useKornerIcon(connection.targetSlug);
  const label = manifest?.name ?? connection.targetSlug;

  const handleRemove = useCallback(() => {
    onRemove(connection.id);
  }, [connection.id, onRemove]);

  return (
    <li className='compose-attach-bar__section'>
      <header className='compose-attach-bar__section-header'>
        <KornerIcon className='compose-attach-bar__section-icon' />
        <span className='compose-attach-bar__section-title'>{label}</span>
        <button
          type='button'
          className='compose-attach-bar__section-remove'
          onClick={handleRemove}
          disabled={disabled}
          aria-label={intl.formatMessage(messages.remove)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      </header>

      <div className='compose-attach-bar__section-body'>
        {connection.mode === 'create' &&
          connection.targetSlug === 'albutts' && (
            <AlbumCreateFields
              connection={connection}
              disabled={disabled}
              onUpdate={onUpdate}
            />
          )}
        {connection.mode === 'create' && connection.targetSlug === 'huddle' && (
          <HuddleCreateFields
            connection={connection}
            disabled={disabled}
            onUpdate={onUpdate}
          />
        )}
        {connection.mode === 'link' && (
          <LinkPickFields
            connection={connection}
            disabled={disabled}
            onUpdate={onUpdate}
          />
        )}
      </div>
    </li>
  );
};

interface FieldProps {
  connection: PendingConnection;
  disabled: boolean;
  onUpdate: (id: string, patch: Partial<PendingConnection>) => void;
}

const AlbumCreateFields: React.FC<FieldProps> = ({
  connection,
  disabled,
  onUpdate,
}) => {
  const intl = useIntl();
  const [uploading, setUploading] = useState(false);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(connection.id, { createTitle: e.target.value });
    },
    [connection.id, onUpdate],
  );

  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const previewUrl = URL.createObjectURL(file);
      setUploading(true);
      void uploadMedia(file)
        .then((id) => {
          onUpdate(connection.id, {
            createCoverId: id,
            createCoverPreviewUrl: previewUrl,
          });
        })
        .catch(() => {
          // Silent on failure — the field just stays blank; server
          // falls back to the event's cover. The user can re-pick.
          onUpdate(connection.id, {
            createCoverId: undefined,
            createCoverPreviewUrl: undefined,
          });
        })
        .finally(() => {
          setUploading(false);
        });
    },
    [connection.id, onUpdate],
  );

  return (
    <>
      <label className='compose-attach-bar__field'>
        <span className='compose-attach-bar__field-label'>
          {intl.formatMessage(messages.albumTitleLabel)}
        </span>
        <input
          type='text'
          value={connection.createTitle ?? ''}
          onChange={handleTitleChange}
          disabled={disabled}
          maxLength={240}
        />
        <small className='compose-attach-bar__field-hint'>
          {intl.formatMessage(messages.albumTitleHint)}
        </small>
      </label>

      <label className='compose-attach-bar__field'>
        <span className='compose-attach-bar__field-label'>
          {intl.formatMessage(messages.albumCoverLabel)}
        </span>
        <input
          type='file'
          accept='image/*'
          onChange={handleCoverChange}
          disabled={disabled || uploading}
        />
        {connection.createCoverPreviewUrl && (
          <img
            src={connection.createCoverPreviewUrl}
            alt=''
            className='compose-attach-bar__cover-preview'
          />
        )}
      </label>
    </>
  );
};

const HuddleCreateFields: React.FC<FieldProps> = ({
  connection,
  disabled,
  onUpdate,
}) => {
  const intl = useIntl();

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(connection.id, { createTitle: e.target.value });
    },
    [connection.id, onUpdate],
  );

  return (
    <label className='compose-attach-bar__field'>
      <span className='compose-attach-bar__field-label'>
        {intl.formatMessage(messages.huddleTitleLabel)}
      </span>
      <input
        type='text'
        value={connection.createTitle ?? ''}
        onChange={handleTitleChange}
        disabled={disabled}
        maxLength={200}
      />
      <small className='compose-attach-bar__field-hint'>
        {intl.formatMessage(messages.huddleTitleHint)}
      </small>
    </label>
  );
};

const LinkPickFields: React.FC<FieldProps> = ({
  connection,
  disabled,
  onUpdate,
}) => {
  const intl = useIntl();
  const manifest = useKorner(connection.targetSlug);
  const label = manifest?.name ?? connection.targetSlug;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (connection.linkTargetId) return; // already picked; skip search

    const trimmed = query.trim();
    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      apiSearchAttachmentCandidates(connection.targetSlug, trimmed)
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
  }, [connection.linkTargetId, connection.targetSlug, query]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handlePick = useCallback(
    (row: AttachmentCandidateJSON) => {
      onUpdate(connection.id, {
        linkTargetId: row.id,
        linkTitle: row.title ?? row.id,
      });
    },
    [connection.id, onUpdate],
  );

  const handleClearPick = useCallback(() => {
    onUpdate(connection.id, {
      linkTargetId: undefined,
      linkTitle: undefined,
    });
  }, [connection.id, onUpdate]);

  if (connection.linkTargetId && connection.linkTitle) {
    return (
      <div className='compose-attach-bar__picked'>
        <span>
          {intl.formatMessage(messages.pickedTitle, {
            title: connection.linkTitle,
          })}
        </span>
        <button
          type='button'
          className='compose-attach-bar__picked-change'
          onClick={handleClearPick}
          disabled={disabled}
        >
          <FormattedMessage {...messages.changePick} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        type='search'
        className='compose-attach-bar__search'
        value={query}
        onChange={handleQueryChange}
        placeholder={intl.formatMessage(messages.searchPlaceholder, {
          korner: label,
        })}
        disabled={disabled}
      />
      <div className='compose-attach-bar__results' role='listbox'>
        {searching && (
          <p className='compose-attach-bar__status'>
            <FormattedMessage {...messages.searching} />
          </p>
        )}
        {!searching && results.length === 0 && (
          <p className='compose-attach-bar__status'>
            <FormattedMessage {...messages.noResults} />
          </p>
        )}
        {results.map((row) => (
          <ResultRow key={row.id} row={row} onPick={handlePick} />
        ))}
      </div>
    </>
  );
};

const ResultRow: React.FC<{
  row: AttachmentCandidateJSON;
  onPick: (row: AttachmentCandidateJSON) => void;
}> = ({ row, onPick }) => {
  const handleClick = useCallback(() => {
    onPick(row);
  }, [onPick, row]);
  return (
    <button
      type='button'
      className='compose-attach-bar__result'
      onClick={handleClick}
      role='option'
      aria-selected='false'
    >
      {row.title ?? row.id}
    </button>
  );
};

// Media upload helper — reused for the album cover picker. Same
// endpoint the composers use for event covers etc.
async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { default: api } = await import('mastodon/api');
  const res = await api().post<{ id: string }>('/api/v2/media', form);
  return res.data.id;
}
