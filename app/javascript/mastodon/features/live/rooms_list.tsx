// Rooms list — the open topical Huddle Rooms surface on
// `/hub/huddle`. Sits between the Main Huddle lobby chrome and the
// "Huddle Up" button. Fetches from `GET /api/v1/huddle/rooms` and
// links each Room card to `/hub/huddle/room/:id`.
//
// The "New Room" action is NOT rendered here — it lives on the Ж
// floating Kronk menu (see config/korners/huddle.yaml `compose:` +
// docs/korners/adding_a_korner.md §11.5, "Never build a per-page
// 'Add' / 'New X' / 'Create' button"). Tapping "New Room" on the Ж
// menu routes the user to `/hub/huddle/new`, which mounts this
// component with `autoOpenCreate` — we open the inline create form
// on mount and clean the URL back to `/hub/huddle`.
//
// See docs/spaces/huddle.md § Three categories of Huddle. Phase 9.6
// discovery slice — no Krew Huddles here yet (Phase 9.1 / 9.2).

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import { apiRequestGet, apiRequestPost } from 'mastodon/api';

interface HuddleRoomJSON {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  session_url: string;
  occupancy: number;
  last_active_at: string | null;
  created_at: string;
}

const messages = defineMessages({
  heading: {
    id: 'huddle.rooms.heading',
    defaultMessage: 'Rooms',
  },
  namePrompt: {
    id: 'huddle.rooms.name_prompt',
    defaultMessage: 'Room name',
  },
  descriptionPrompt: {
    id: 'huddle.rooms.description_prompt',
    defaultMessage: 'What is this room for? (optional)',
  },
  iconPrompt: {
    id: 'huddle.rooms.icon_prompt',
    defaultMessage: 'Emoji (optional)',
  },
  create: {
    id: 'huddle.rooms.create',
    defaultMessage: 'Create',
  },
  cancel: {
    id: 'huddle.rooms.cancel',
    defaultMessage: 'Cancel',
  },
  empty: {
    id: 'huddle.rooms.empty',
    // Empty-state copy points at the Ж menu per the Korner
    // Standard — no click target inline.
    defaultMessage: 'No rooms yet — start one via the Ж menu.',
  },
  occupancy: {
    id: 'huddle.rooms.occupancy',
    defaultMessage:
      '{count, plural, =0 {empty} one {# here now} other {# here now}}',
  },
});

export const RoomsList: React.FC<{ autoOpenCreate?: boolean }> = ({
  autoOpenCreate,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [rooms, setRooms] = useState<HuddleRoomJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(Boolean(autoOpenCreate));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequestGet<HuddleRoomJSON[]>('v1/huddle/rooms');
      setRooms(data);
    } catch {
      // Discovery is best-effort — swallow and render empty. A retry
      // would land on the next mount.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  // If the Ж menu routed us here (`/hub/huddle/new`), clean the URL
  // back to the plain `/hub/huddle` on mount so the create-form flag
  // doesn't stick around on refresh (mirrors Albutts's
  // /hub/albutts/new pattern in features/albutts/index.tsx).
  useEffect(() => {
    if (autoOpenCreate) history.replace('/hub/huddle');
  }, [autoOpenCreate, history]);

  const handleCancel = useCallback(() => {
    setShowCreate(false);
    setName('');
    setDescription('');
    setIcon('');
    setError(null);
  }, []);
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleIconChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIcon(e.target.value);
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiRequestPost<HuddleRoomJSON>('v1/huddle/rooms', {
        name: trimmedName,
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
      });
      setRooms((prev) => [created, ...prev]);
      handleCancel();
    } catch {
      setError('Could not create the Room. Try again?');
    } finally {
      setCreating(false);
    }
  }, [name, description, icon, creating, handleCancel]);
  const handleCreateClick = useCallback(() => {
    void handleCreate();
  }, [handleCreate]);

  return (
    <section className='huddle-rooms'>
      <header className='huddle-rooms__header'>
        <h2 className='huddle-rooms__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>
      </header>

      {showCreate && (
        <div className='huddle-rooms__create'>
          <input
            type='text'
            className='huddle-rooms__input'
            placeholder={intl.formatMessage(messages.namePrompt)}
            value={name}
            onChange={handleNameChange}
            maxLength={80}
          />
          <input
            type='text'
            className='huddle-rooms__input'
            placeholder={intl.formatMessage(messages.descriptionPrompt)}
            value={description}
            onChange={handleDescriptionChange}
            maxLength={200}
          />
          <input
            type='text'
            className='huddle-rooms__input huddle-rooms__input--icon'
            placeholder={intl.formatMessage(messages.iconPrompt)}
            value={icon}
            onChange={handleIconChange}
            maxLength={8}
          />
          {error && <p className='huddle-rooms__error'>{error}</p>}
          <div className='huddle-rooms__create-actions'>
            <button
              type='button'
              className='huddle-rooms__cancel'
              onClick={handleCancel}
              disabled={creating}
            >
              {intl.formatMessage(messages.cancel)}
            </button>
            <button
              type='button'
              className='huddle-rooms__submit'
              onClick={handleCreateClick}
              disabled={creating || name.trim().length === 0}
            >
              {intl.formatMessage(messages.create)}
            </button>
          </div>
        </div>
      )}

      {!loading && rooms.length === 0 && !showCreate && (
        <p className='huddle-rooms__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      <ul className='huddle-rooms__grid'>
        {rooms.map((r) => (
          <li key={r.id} className='huddle-rooms__card'>
            <Link
              to={`/hub/huddle/room/${r.id}`}
              className='huddle-rooms__card-link'
            >
              <span className='huddle-rooms__card-icon'>{r.icon ?? '💬'}</span>
              <span className='huddle-rooms__card-body'>
                <span className='huddle-rooms__card-name'>{r.name}</span>
                {r.description && (
                  <span className='huddle-rooms__card-desc'>
                    {r.description}
                  </span>
                )}
                <span className='huddle-rooms__card-occ'>
                  {intl.formatMessage(messages.occupancy, {
                    count: r.occupancy,
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
