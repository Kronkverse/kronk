import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import { apiUpdateProfileSection } from 'mastodon/api/profile_sections';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';

// Post picker for a drawn shelf in `chosen` order. Populates
// `settings.order_ids` by letting the owner tick which of their own
// matching posts appear on this shelf and drag them into place.
//
// MVP shape — a single vertical list:
//
//   * Fetches the account's statuses via the standard
//     `/api/v1/accounts/:id/statuses` endpoint (up to 100), then
//     filters client-side by `source_korner` matching the shelf's
//     `settings.korner_slug`. No new backend surface — the source
//     korner discriminator ships in every status JSON already.
//
//   * Rows are sorted: picked first in their curated order, then
//     unpicked in reverse-chronological order. Toggle a row's
//     checkbox to add/remove; picked rows expose ▲/▼ arrows for
//     reordering.
//
//   * Save PUTs `settings.order = 'chosen'` + `settings.order_ids =
//     [...]` on the shelf. Cancel closes without writing.

const MAX_POSTS_FETCHED = 100;

const messages = defineMessages({
  kicker: {
    id: 'profile_shelves.picker.kicker',
    defaultMessage: 'Chosen order',
  },
  heading: {
    id: 'profile_shelves.picker.heading',
    defaultMessage: 'Pick the posts on this shelf',
  },
  lede: {
    id: 'profile_shelves.picker.lede',
    defaultMessage:
      'Tick a post to add it. Reorder picked posts with the arrows. Nothing here changes the posts themselves.',
  },
  loading: {
    id: 'profile_shelves.picker.loading',
    defaultMessage: 'Loading your posts…',
  },
  empty: {
    id: 'profile_shelves.picker.empty',
    defaultMessage: 'No posts on this shelf yet.',
  },
  save: { id: 'profile_shelves.picker.save', defaultMessage: 'Save picks' },
  cancel: { id: 'profile_shelves.picker.cancel', defaultMessage: 'Cancel' },
  saving: {
    id: 'profile_shelves.picker.saving',
    defaultMessage: 'Saving…',
  },
  moveUp: {
    id: 'profile_shelves.picker.move_up',
    defaultMessage: 'Move up',
  },
  moveDown: {
    id: 'profile_shelves.picker.move_down',
    defaultMessage: 'Move down',
  },
});

// Simple client-side match against `source_korner`. `korner` fallback
// means "everything with a source_korner value" — treat every korner
// projection as belonging to this shelf. Not currently reachable via
// the composer (a real korner_slug lands whenever a preset is added),
// kept as defensive default.
const matchesKornerSlug = (status: ApiStatusJSON, slug: string): boolean =>
  slug === 'korner'
    ? Boolean(status.source_korner)
    : status.source_korner === slug;

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const excerpt = (status: ApiStatusJSON): string => {
  const raw = status.content ?? status.text ?? '';
  const text = stripHtml(raw);
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
};

interface PostPickerProps {
  accountId: string;
  sectionId: string;
  kornerSlug: string;
  initialOrderIds: string[];
  onSaved: (orderIds: string[]) => void;
  onCancel: () => void;
}

interface PickRow {
  status: ApiStatusJSON;
  pickedIndex: number; // -1 when unpicked
}

interface PostPickerRowProps {
  status: ApiStatusJSON;
  pickedIndex: number;
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const PostPickerRow: React.FC<PostPickerRowProps> = ({
  status,
  pickedIndex,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) => {
  const intl = useIntl();
  const picked = pickedIndex >= 0;
  const handleToggle = useCallback(() => {
    onToggle(status.id);
  }, [onToggle, status.id]);
  const handleUp = useCallback(() => {
    onMoveUp(status.id);
  }, [onMoveUp, status.id]);
  const handleDown = useCallback(() => {
    onMoveDown(status.id);
  }, [onMoveDown, status.id]);

  return (
    <li
      className={`profile-shelves__picker-row${picked ? ' profile-shelves__picker-row--picked' : ''}`}
    >
      <input
        type='checkbox'
        className='profile-shelves__picker-check'
        checked={picked}
        onChange={handleToggle}
      />
      <div className='profile-shelves__picker-body'>
        <div className='profile-shelves__picker-excerpt'>{excerpt(status)}</div>
        <div className='profile-shelves__picker-meta'>
          {new Date(status.created_at).toLocaleDateString()}
        </div>
      </div>
      {picked && (
        <div className='profile-shelves__picker-order'>
          <span className='profile-shelves__picker-badge'>{pickedIndex + 1}</span>
          <button
            type='button'
            className='profile-shelves__picker-arrow'
            onClick={handleUp}
            disabled={!canMoveUp}
            aria-label={intl.formatMessage(messages.moveUp)}
          >
            ▲
          </button>
          <button
            type='button'
            className='profile-shelves__picker-arrow'
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

export const PostPicker: React.FC<PostPickerProps> = ({
  accountId,
  sectionId,
  kornerSlug,
  initialOrderIds,
  onSaved,
  onCancel,
}) => {
  const intl = useIntl();

  const [statuses, setStatuses] = useState<ApiStatusJSON[] | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>(initialOrderIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiRequestGet<ApiStatusJSON[]>(`v1/accounts/${accountId}/statuses`, {
      limit: MAX_POSTS_FETCHED,
      exclude_reblogs: true,
      exclude_replies: true,
    })
      .then((data) => {
        if (cancelled) return;
        setStatuses(data.filter((s) => matchesKornerSlug(s, kornerSlug)));
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, kornerSlug]);

  const toggle = useCallback((id: string) => {
    setOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const moveUp = useCallback((id: string) => {
    setOrderIds((prev) => {
      const i = prev.indexOf(id);
      if (i <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      if (!item) return prev;
      next.splice(i - 1, 0, item);
      return next;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setOrderIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0 || i >= prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      if (!item) return prev;
      next.splice(i + 1, 0, item);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    void apiUpdateProfileSection(sectionId, {
      settings: { order: 'chosen', order_ids: orderIds },
    })
      .then(() => {
        setSaving(false);
        onSaved(orderIds);
      })
      .catch(() => {
        setSaving(false);
      });
  }, [onSaved, orderIds, sectionId]);

  const rows: PickRow[] = (statuses ?? []).map((s) => ({
    status: s,
    pickedIndex: orderIds.indexOf(s.id),
  }));
  rows.sort((a, b) => {
    if (a.pickedIndex >= 0 && b.pickedIndex >= 0)
      return a.pickedIndex - b.pickedIndex;
    if (a.pickedIndex >= 0) return -1;
    if (b.pickedIndex >= 0) return 1;
    return b.status.created_at.localeCompare(a.status.created_at);
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
            {intl.formatMessage(messages.heading)}
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
          <ul className='profile-shelves__picker-list'>
            {rows.map((row) => (
              <PostPickerRow
                key={row.status.id}
                status={row.status}
                pickedIndex={row.pickedIndex}
                onToggle={toggle}
                onMoveUp={moveUp}
                onMoveDown={moveDown}
                canMoveUp={row.pickedIndex > 0}
                canMoveDown={
                  row.pickedIndex >= 0 && row.pickedIndex < orderIds.length - 1
                }
              />
            ))}
          </ul>
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
            className='profile-shelves__composer-save'
            onClick={handleSave}
            disabled={saving}
          >
            {intl.formatMessage(saving ? messages.saving : messages.save)}
          </button>
        </div>
      </div>
    </div>
  );
};
