import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import { apiUpdateProfileSection } from 'mastodon/api/profile_sections';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { me } from 'mastodon/initial_state';

// Post picker for one drawn shelf — "I get to choose which albums appear
// here, and in what order" (docs/spaces/profile.md, "The profile board").
// The third of the three orders an owner controls, and the one that had no
// UI: which korners are on, and what order they come in, are both in the
// section selector already.
//
// Candidates come from the shelf's own endpoint with `candidates=1`, which
// returns everything the shelf COULD show rather than what it currently
// shows. That matters twice over: a `chosen` shelf could otherwise only ever
// lose posts, and the candidate query then resolves through the korner
// manifest exactly like the read side does. (The previous draft of this
// picker filtered the account timeline client-side on `source_korner`, which
// is a different notion of "in this korner" and misses anything past the
// first hundred posts.)
//
// Picking writes `settings.order = 'chosen'` + `settings.order_ids`, merged
// over the settings the shelf already carries — the update endpoint replaces
// the whole jsonb, so sending a bare `{order, order_ids}` would strip the
// shelf's `render` and `korner_slug` and be rejected by the model.

const CANDIDATE_LIMIT = 40;

const messages = defineMessages({
  kicker: {
    id: 'profile_shelves.picker.kicker',
    defaultMessage: 'What shows here',
  },
  heading: {
    id: 'profile_shelves.picker.heading',
    defaultMessage: 'Pick the posts on this shelf',
  },
  lede: {
    id: 'profile_shelves.picker.lede',
    defaultMessage:
      'Tap to add a post to this shelf; tap again to take it off. The numbers are the order people swipe through. Nothing here changes the posts themselves.',
  },
  loading: {
    id: 'profile_shelves.picker.loading',
    defaultMessage: 'Loading your posts…',
  },
  empty: {
    id: 'profile_shelves.picker.empty',
    defaultMessage: 'Nothing posted in this korner yet.',
  },
  failed: {
    id: 'profile_shelves.picker.failed',
    defaultMessage: "That didn't save. Try again.",
  },
  save: { id: 'profile_shelves.picker.save', defaultMessage: 'Save order' },
  cancel: { id: 'profile_shelves.picker.cancel', defaultMessage: 'Cancel' },
  saving: { id: 'profile_shelves.picker.saving', defaultMessage: 'Saving…' },
  newest: {
    id: 'profile_shelves.picker.newest',
    defaultMessage: 'Show newest first instead',
  },
  moveUp: { id: 'profile_shelves.picker.move_up', defaultMessage: 'Move up' },
  moveDown: {
    id: 'profile_shelves.picker.move_down',
    defaultMessage: 'Move down',
  },
  untitled: {
    id: 'profile_shelves.picker.untitled',
    defaultMessage: 'Untitled',
  },
});

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Every korner attaches its own summary object to the status (album,
// booth_set, trek, …) and they all carry a title and most carry a cover, so
// one defensive read covers every render shape rather than a switch that has
// to grow a case per korner.
interface KornerSummary {
  title?: string | null;
  name?: string | null;
  cover_url?: string | null;
}

type WithKornerData = ApiStatusJSON & {
  album?: KornerSummary;
  booth_set?: KornerSummary;
  listing?: KornerSummary;
};

const summaryOf = (status: ApiStatusJSON): KornerSummary | undefined => {
  const s = status as WithKornerData;
  return (
    s.album ??
    s.booth_set ??
    s.listing ??
    (status.trek as KornerSummary | undefined) ??
    (status.question as KornerSummary | undefined)
  );
};

const titleOf = (status: ApiStatusJSON, fallback: string): string => {
  const summary = summaryOf(status);
  const named = summary?.title ?? summary?.name;
  if (named) return named;

  const text = stripHtml(status.content ?? status.text ?? '');
  if (text.length === 0) return fallback;
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
};

const coverOf = (status: ApiStatusJSON): string | null =>
  summaryOf(status)?.cover_url ??
  status.media_attachments[0]?.preview_url ??
  null;

interface PickTileProps {
  status: ApiStatusJSON;
  pickedIndex: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (id: string) => void;
  onMove: (id: string, delta: 1 | -1) => void;
}

const PickTile: React.FC<PickTileProps> = ({
  status,
  pickedIndex,
  canMoveUp,
  canMoveDown,
  onToggle,
  onMove,
}) => {
  const intl = useIntl();
  const picked = pickedIndex >= 0;
  const cover = coverOf(status);
  const title = titleOf(status, intl.formatMessage(messages.untitled));

  const handleToggle = useCallback(() => {
    onToggle(status.id);
  }, [onToggle, status.id]);
  const handleUp = useCallback(() => {
    onMove(status.id, -1);
  }, [onMove, status.id]);
  const handleDown = useCallback(() => {
    onMove(status.id, 1);
  }, [onMove, status.id]);

  return (
    <li
      className={`profile-shelves__pick${picked ? ' profile-shelves__pick--on' : ''}`}
    >
      {/* The tile is the control: on a phone a checkbox beside a thumbnail is
          a smaller target than the thumbnail itself, and the thing being
          picked is the picture. */}
      <button
        type='button'
        className='profile-shelves__pick-tile'
        aria-pressed={picked}
        onClick={handleToggle}
      >
        <span
          className='profile-shelves__pick-cover'
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          {picked && (
            <span className='profile-shelves__pick-badge'>
              {pickedIndex + 1}
            </span>
          )}
        </span>
        <span className='profile-shelves__pick-title'>{title}</span>
      </button>
      {picked && (
        <div className='profile-shelves__pick-order'>
          <button
            type='button'
            className='profile-shelves__pick-arrow'
            onClick={handleUp}
            disabled={!canMoveUp}
            aria-label={intl.formatMessage(messages.moveUp)}
          >
            ▲
          </button>
          <button
            type='button'
            className='profile-shelves__pick-arrow'
            onClick={handleDown}
            disabled={!canMoveDown}
            aria-label={intl.formatMessage(messages.moveDown)}
          >
            ▼
          </button>
        </div>
      )}
    </li>
  );
};

interface PostPickerProps {
  section: ApiProfileSectionJSON;
  onSaved: (section: ApiProfileSectionJSON) => void;
  onCancel: () => void;
}

export const PostPicker: React.FC<PostPickerProps> = ({
  section,
  onSaved,
  onCancel,
}) => {
  const intl = useIntl();

  const [statuses, setStatuses] = useState<ApiStatusJSON[] | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>(() =>
    section.settings.order === 'chosen'
      ? Array.isArray(section.settings.order_ids)
        ? (section.settings.order_ids as string[])
        : []
      : [],
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<ApiStatusJSON[]>(
      `v1/accounts/${me}/profile/sections/${section.id}/statuses`,
      { candidates: '1', limit: CANDIDATE_LIMIT },
    )
      .then((data) => {
        if (!cancelled) setStatuses(data);
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section.id]);

  const toggle = useCallback((id: string) => {
    setOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const move = useCallback((id: string, delta: 1 | -1) => {
    setOrderIds((prev) => {
      const from = prev.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item === undefined) return prev;
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  // Both buttons write the same shape: the shelf's own settings with the
  // order swapped. `newest` clears the picks rather than keeping them
  // dormant — a list nobody can see is a list nobody can fix.
  const write = useCallback(
    (settings: Record<string, unknown>) => {
      setSaving(true);
      setFailed(false);
      void apiUpdateProfileSection(section.id, {
        settings: { ...section.settings, ...settings },
      })
        .then((updated) => {
          setSaving(false);
          onSaved(updated);
        })
        .catch(() => {
          setSaving(false);
          setFailed(true);
        });
    },
    [onSaved, section.id, section.settings],
  );

  const handleSave = useCallback(() => {
    write({ order: 'chosen', order_ids: orderIds });
  }, [write, orderIds]);

  const handleNewest = useCallback(() => {
    write({ order: 'newest', order_ids: [] });
  }, [write]);

  // Picked first, in the order they will be swiped through; the rest newest
  // first underneath. The list reorders under the owner as they pick, which
  // is the point — what they are building is the top of it.
  const rows = [...(statuses ?? [])].sort((a, b) => {
    const ai = orderIds.indexOf(a.id);
    const bi = orderIds.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <div
      className='profile-shelves__composer-scrim'
      role='dialog'
      aria-modal
      aria-label={intl.formatMessage(messages.heading)}
    >
      <div className='profile-shelves__composer profile-shelves__picker'>
        <header className='profile-shelves__composer-head'>
          <div className='profile-shelves__composer-kicker'>
            {intl.formatMessage(messages.kicker)}
          </div>
          <h2 className='profile-shelves__composer-title'>
            {section.title ?? intl.formatMessage(messages.heading)}
          </h2>
        </header>

        <p className='profile-shelves__composer-hint'>
          {intl.formatMessage(messages.lede)}
        </p>

        {statuses === null ? (
          <div className='profile-shelves__composer-hint'>
            {intl.formatMessage(messages.loading)}
          </div>
        ) : rows.length === 0 ? (
          <div className='profile-shelves__composer-hint'>
            {intl.formatMessage(messages.empty)}
          </div>
        ) : (
          <ul className='profile-shelves__pick-grid'>
            {rows.map((status) => {
              const pickedIndex = orderIds.indexOf(status.id);
              return (
                <PickTile
                  key={status.id}
                  status={status}
                  pickedIndex={pickedIndex}
                  canMoveUp={pickedIndex > 0}
                  canMoveDown={
                    pickedIndex >= 0 && pickedIndex < orderIds.length - 1
                  }
                  onToggle={toggle}
                  onMove={move}
                />
              );
            })}
          </ul>
        )}

        {failed && (
          <p className='profile-shelves__composer-hint'>
            {intl.formatMessage(messages.failed)}
          </p>
        )}

        <div className='profile-shelves__composer-actions'>
          <button
            type='button'
            className='profile-shelves__composer-cancel'
            onClick={onCancel}
            disabled={saving}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            type='button'
            className='profile-shelves__composer-cancel'
            onClick={handleNewest}
            disabled={saving || section.settings.order !== 'chosen'}
          >
            {intl.formatMessage(messages.newest)}
          </button>
          <button
            type='button'
            className='profile-shelves__composer-save'
            onClick={handleSave}
            disabled={saving || orderIds.length === 0}
          >
            {intl.formatMessage(saving ? messages.saving : messages.save)}
          </button>
        </div>
      </div>
    </div>
  );
};
