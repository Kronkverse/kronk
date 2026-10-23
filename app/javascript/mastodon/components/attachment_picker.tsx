import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  AttachmentCandidateJSON,
  AttachmentKind,
} from 'mastodon/api/attachments';
import { apiSearchAttachmentCandidates } from 'mastodon/api/attachments';
import { Icon } from 'mastodon/components/icon';
import { useAttachTargets } from 'mastodon/hooks/useAttachTargets';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import type { KonnectTarget } from 'mastodon/hooks/useKonnect';
import { konnectSearch } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// The API refuses `spawn` on POST — narrow the picker's chosen kind
// so callers of `addLink` don't have to re-prove it at every use.
type PickerKind = Exclude<AttachmentKind, 'spawn'>;

// AttachmentPicker — the modal behind the Konnect tile
// on any detail page (docs/korners/adding_a_korner.md (Korner attachments) §4.3).
//
// Piggybacks on the ComposeShell / ConfirmDialog modal grammar:
// portal-mounted, backdrop click to cancel, Escape to cancel, focused
// panel with heading + body + footer. The panel itself is smaller than
// the compose shell because the flow is one-step (pick a target, pick
// a record) and doesn't need the full composer chrome.
//
// Offers the korners `useAttachTargets` names: the source manifest's
// `attaches:` entries, a wildcard link reaching every korner that
// accepts one. When there are none the modal shows a "This korner
// cannot attach to anything yet" empty state.
//
// Once a space is picked, a space whose manifest says `konnect: { make:
// true }` also offers its composer ("New album"): the picker closes and the
// composer opens with `?konnect=<source slug>:<source id>`, so what it makes
// is Konnected here (decisions.md, 2026-10-23).
//
// Inside a composer the record doesn't exist yet, so there is nothing to
// save a link from: given `onPick`, the picker hands back the record chosen
// and saves nothing (`<ComposeShell konnect={…}>`, hooks/useKonnect.ts).
//
// Kind is set to `link` today (user-added, independent lifecycle).
// A future update could read the manifest's `kind:` on each entry
// and offer per-target defaults; keeping it uniform for now to match
// Phase 3's Kalendar-first adoption.

const messages = defineMessages({
  heading: {
    id: 'attachment_picker.heading',
    defaultMessage: 'Konnect something',
  },
  cancel: { id: 'attachment_picker.cancel', defaultMessage: 'Cancel' },
  searchPlaceholder: {
    id: 'attachment_picker.search_placeholder',
    defaultMessage: 'Search {korner}…',
  },
  chooseSpace: {
    id: 'attachment_picker.choose_space_konnect',
    defaultMessage: 'Which space is it in?',
  },
  targetLabel: {
    id: 'attachment_picker.target_label_konnect',
    defaultMessage: 'Konnect to',
  },
  change: { id: 'attachment_picker.change', defaultMessage: 'Change' },
  searching: {
    id: 'attachment_picker.searching',
    defaultMessage: 'Searching…',
  },
  noResults: {
    id: 'attachment_picker.no_results',
    defaultMessage: 'No matches.',
  },
  showPast: {
    id: 'attachment_picker.show_past_events',
    defaultMessage: 'Show past events',
  },
  showUpcoming: {
    id: 'attachment_picker.show_upcoming_events',
    defaultMessage: 'Show upcoming events',
  },
  emptyManifest: {
    id: 'attachment_picker.empty_manifest',
    defaultMessage: 'Nothing can be Konnected here yet.',
  },
  attachError: {
    id: 'attachment_picker.konnect_error',
    defaultMessage: "Couldn't Konnect it: {message}.",
  },
});

interface AttachmentPickerProps {
  sourceSlug: string;
  // The record Konnecting. Left out with `onPick`: it isn't made yet.
  sourceId?: string | number;
  onClose: () => void;
  onAttached?: () => void;
  // Pick, don't save: the chosen record is handed back instead of linked.
  onPick?: (target: KonnectTarget) => void;
  // Records already chosen, left out of the results.
  exclude?: Pick<KonnectTarget, 'slug' | 'id'>[];
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  sourceSlug,
  sourceId,
  onClose,
  onAttached,
  onPick,
  exclude,
}) => {
  const intl = useIntl();
  const { addLink } = useAttachments(sourceSlug, onPick ? null : sourceId);
  // The korners this record can attach to, wildcards included.
  const targetSlugs = useAttachTargets(sourceSlug);

  // With several spaces to choose from, nothing is picked until the person
  // picks one: defaulting to the first (Huddle) sent people searching the
  // wrong space (Tal 2026-10-22). A single space is picked for them.
  const [target, setTarget] = useState<
    { slug: string; kind: PickerKind } | undefined
  >(() => (targetSlugs.length === 1 ? targetSlugs[0] : undefined));
  // Track when targetSlugs changes (async manifest load).
  useEffect(() => {
    if (!target && targetSlugs.length === 1) setTarget(targetSlugs[0]);
  }, [target, targetSlugs]);
  const targetManifest = useKorner(target?.slug);

  // "New album": the space's own composer, Konnecting what it makes here.
  const history = useHistory();
  // `konnect.route` / `konnect.label` win over `compose:` (a korner whose
  // Ж-menu composer isn't the one that makes its linkable records).
  const konnectMake = targetManifest?.konnect;
  const makeRoute = konnectMake?.route ?? targetManifest?.compose?.route;
  const makeLabel = konnectMake?.label ?? targetManifest?.compose?.label;
  const makeNew =
    !onPick &&
    sourceId != null &&
    konnectMake?.make === true &&
    makeRoute &&
    makeLabel
      ? { route: makeRoute, label: makeLabel }
      : undefined;
  const makeNewRoute = makeNew?.route;
  const handleMakeNew = useCallback(() => {
    if (!makeNewRoute || sourceId == null) return;
    onClose();
    // A location object, not one string: this app's router wrapper folds a
    // query in a pushed string into the pathname, so the composer route
    // wouldn't match (it opened the record page for "composer?konnect=…").
    history.push({
      pathname: makeNewRoute,
      search: konnectSearch(sourceSlug, sourceId),
    });
  }, [makeNewRoute, onClose, history, sourceSlug, sourceId]);

  const [query, setQuery] = useState('');
  // Kalendar offers upcoming events; past ones are a tap away.
  const [past, setPast] = useState(false);
  const datesEvents = target?.slug === 'kalendar';
  const [results, setResults] = useState<AttachmentCandidateJSON[]>([]);
  const [searching, setSearching] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search input once there's a space to search.
  useEffect(() => {
    inputRef.current?.focus();
  }, [target]);

  // Escape closes. Over a composer (`onPick`) it closes only the picker:
  // caught on the way down, so the composer underneath never hears it.
  const capture = Boolean(onPick);
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (capture) e.stopPropagation();
      if (!attaching) onClose();
    };
    window.addEventListener('keydown', handleKey, capture);
    return () => {
      window.removeEventListener('keydown', handleKey, capture);
    };
  }, [attaching, onClose, capture]);

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
      apiSearchAttachmentCandidates(
        target.slug,
        trimmed,
        20,
        datesEvents && past,
      )
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
  }, [target, query, datesEvents, past]);

  const handleAttach = useCallback(
    async (row: AttachmentCandidateJSON) => {
      if (!target || attaching) return;
      if (onPick) {
        onPick({ slug: target.slug, id: row.id, title: row.title });
        onClose();
        return;
      }
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
    [addLink, attaching, intl, onAttached, onClose, onPick, target],
  );

  const excludeKey = (exclude ?? []).map((e) => `${e.slug}/${e.id}`).join(' ');
  const shown = useMemo(() => {
    if (!excludeKey) return results;
    const skip = new Set(excludeKey.split(' '));
    return results.filter((row) => !skip.has(`${row.slug}/${row.id}`));
  }, [results, excludeKey]);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    [],
  );

  const handleTogglePast = useCallback(() => {
    setPast((was) => !was);
  }, []);

  const clearTarget = useCallback(() => {
    setTarget(undefined);
    setQuery('');
    setPast(false);
  }, []);

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
            {target ? (
              <TargetChip
                slug={target.slug}
                label={intl.formatMessage(messages.targetLabel)}
                changeLabel={intl.formatMessage(messages.change)}
                onChange={targetSlugs.length > 1 ? clearTarget : undefined}
                disabled={attaching}
              />
            ) : (
              <>
                <p className='attachment-picker__status'>
                  <FormattedMessage {...messages.chooseSpace} />
                </p>
                <ul className='space-tiles attachment-picker__spaces'>
                  {targetSlugs.map((t) => (
                    <TargetTile
                      key={t.slug}
                      slug={t.slug}
                      kind={t.kind}
                      disabled={attaching}
                      onSelect={setTarget}
                    />
                  ))}
                </ul>
              </>
            )}

            {target ? (
              <>
                {makeNew && (
                  <button
                    type='button'
                    className='attachment-picker__spawn'
                    onClick={handleMakeNew}
                    disabled={attaching}
                  >
                    <Icon
                      id='add'
                      icon={AddIcon}
                      className='attachment-picker__plus'
                    />
                    {makeNew.label}
                  </button>
                )}
                <input
                  ref={inputRef}
                  className='attachment-picker__search'
                  type='search'
                  value={query}
                  onChange={handleQueryChange}
                  disabled={attaching}
                  placeholder={intl.formatMessage(messages.searchPlaceholder, {
                    korner: targetManifest?.name ?? target.slug,
                  })}
                />

                {datesEvents && (
                  <button
                    type='button'
                    className='attachment-picker__when'
                    onClick={handleTogglePast}
                    disabled={attaching}
                  >
                    <FormattedMessage
                      {...(past ? messages.showUpcoming : messages.showPast)}
                    />
                  </button>
                )}

                <div className='attachment-picker__results'>
                  {searching && (
                    <p className='attachment-picker__status'>
                      <FormattedMessage {...messages.searching} />
                    </p>
                  )}
                  {!searching && shown.length === 0 && (
                    <p className='attachment-picker__status'>
                      <FormattedMessage {...messages.noResults} />
                    </p>
                  )}
                  {shown.map((row) => (
                    <CandidateRow
                      key={row.id}
                      row={row}
                      disabled={attaching}
                      onAttach={handleAttach}
                    />
                  ))}
                </div>
              </>
            ) : null}

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
// The space being searched, with Change back to the tiles when there's
// more than one.
const TargetChip: React.FC<{
  slug: string;
  label: string;
  changeLabel: string;
  onChange?: () => void;
  disabled: boolean;
}> = ({ slug, label, changeLabel, onChange, disabled }) => {
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
      {onChange && (
        <button
          type='button'
          className='attachment-picker__change'
          onClick={onChange}
          disabled={disabled}
        >
          {changeLabel}
        </button>
      )}
    </div>
  );
};

interface TargetTileProps {
  slug: string;
  kind: PickerKind;
  disabled: boolean;
  onSelect: (target: { slug: string; kind: PickerKind }) => void;
}

// A space that can be Konnected to, as a space tile.
const TargetTile: React.FC<TargetTileProps> = ({
  slug,
  kind,
  disabled,
  onSelect,
}) => {
  const manifest = useKorner(slug);
  const Icon = useKornerIcon(slug);
  const handleClick = useCallback(() => {
    onSelect({ slug, kind });
  }, [onSelect, slug, kind]);
  return (
    <li>
      <button
        type='button'
        className='space-tile'
        onClick={handleClick}
        disabled={disabled}
      >
        <Icon className='space-tile__glyph' />
        <span className='space-tile__name'>{manifest?.name ?? slug}</span>
      </button>
    </li>
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
      <span className='attachment-picker__result-text'>
        <span className='attachment-picker__result-title'>
          {row.title ?? row.id}
        </span>
        {row.subtitle && (
          <span className='attachment-picker__result-subtitle'>
            {row.subtitle}
          </span>
        )}
      </span>
    </button>
  );
};
