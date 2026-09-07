import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { DragEndEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { ApiProfileLibraryJSON } from 'mastodon/api/profile_library';
import { apiGetProfileLibrary } from 'mastodon/api/profile_library';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import {
  apiCreateProfileSection,
  apiReorderProfileSections,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';

import { PostPicker } from './post_picker';
import { ShelfDrawn } from './shelf_drawn';

// Arranging a profile happens ON the profile. There is no separate Arrange
// page and there never was a separate URL — the old surface simply swapped
// the whole profile out for a panel of on/off switches, so the one thing you
// were arranging was the one thing you could not see.
//
// Here the owner sees their real shelves, in their real order, at their real
// size, with a grab bar on each. Press and hold a bar and the shelf lifts;
// drag it up or down and the order it lands in is the order a visitor gets.
//
// Hold-to-lift rather than drag-on-contact, because this page already spends
// both directions: it scrolls vertically and each shelf swipes sideways. A
// drag that started on contact would fight both. dnd-kit's TouchSensor takes
// a delay + tolerance, which is exactly "hold still for a moment, then it's
// yours" — and once it activates, the sensor owns the gesture, so the swipe
// underneath stops competing for it.
//
// The up/down buttons stay. They are the keyboard and screen-reader path, and
// they are also what works when someone's hold is too shaky to register.

const HOLD_MS = 300;
const HOLD_TOLERANCE_PX = 8;

const messages = defineMessages({
  grab: {
    id: 'profile_shelves.arrange.grab',
    defaultMessage: 'Hold to move {name}',
  },
  moveUp: { id: 'profile_shelves.arrange.move_up', defaultMessage: 'Move up' },
  moveDown: {
    id: 'profile_shelves.arrange.move_down',
    defaultMessage: 'Move down',
  },
  choose: {
    id: 'profile_shelves.arrange.choose',
    defaultMessage: 'Choose posts',
  },
  remove: {
    id: 'profile_shelves.arrange.remove',
    defaultMessage: 'Take off profile',
  },
  add: { id: 'profile_shelves.arrange.add', defaultMessage: 'Add a korner' },
  addTitle: {
    id: 'profile_shelves.arrange.add_title',
    defaultMessage: 'What do you want to show?',
  },
  addLede: {
    id: 'profile_shelves.arrange.add_lede',
    defaultMessage:
      'These are the korners you have posted in. Adding one shows those posts on your profile — it never copies or moves them.',
  },
  addEmpty: {
    id: 'profile_shelves.arrange.add_empty',
    defaultMessage:
      'Nothing new to add. Post in a korner and it will show up here.',
  },
  addCount: {
    id: 'profile_shelves.arrange.add_count',
    defaultMessage: '{count, plural, one {# post} other {# posts}}',
  },
  cancel: {
    id: 'profile_shelves.arrange.cancel',
    defaultMessage: 'Cancel',
  },
  empty: {
    id: 'profile_shelves.arrange.empty',
    defaultMessage: 'Your profile is empty. Add a korner to start it.',
  },
});

const kornerSlugOf = (section: ApiProfileSectionJSON) =>
  section.settings.korner_slug as string | undefined;

interface SortableShelfProps {
  accountId: string;
  section: ApiProfileSectionJSON;
  index: number;
  total: number;
  onChoose: (section: ApiProfileSectionJSON) => void;
  onRemove: (section: ApiProfileSectionJSON) => void;
  onMove: (section: ApiProfileSectionJSON, delta: 1 | -1) => void;
}

const SortableShelf: React.FC<SortableShelfProps> = ({
  accountId,
  section,
  index,
  total,
  onChoose,
  onRemove,
  onMove,
}) => {
  const intl = useIntl();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const handleChoose = useCallback(() => {
    onChoose(section);
  }, [onChoose, section]);
  const handleRemove = useCallback(() => {
    onRemove(section);
  }, [onRemove, section]);
  const handleUp = useCallback(() => {
    onMove(section, -1);
  }, [onMove, section]);
  const handleDown = useCallback(() => {
    onMove(section, 1);
  }, [onMove, section]);

  // A button inside the grab bar must not also arm the drag, or every tap on
  // "Choose posts" is a hold waiting to become a lift.
  const swallow = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const name = section.title ?? kornerSlugOf(section) ?? '';

  return (
    <li
      ref={setNodeRef}
      className={`profile-arrange__shelf${isDragging ? ' profile-arrange__shelf--lifted' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div
        className='profile-arrange__bar'
        aria-label={intl.formatMessage(messages.grab, { name })}
        {...attributes}
        {...listeners}
      >
        <span className='profile-arrange__grip' aria-hidden>
          ⠿
        </span>
        <span className='profile-arrange__name'>{name}</span>
        <div className='profile-arrange__bar-actions'>
          <button
            type='button'
            className='profile-arrange__step'
            onPointerDown={swallow}
            onClick={handleUp}
            disabled={index === 0}
            aria-label={intl.formatMessage(messages.moveUp)}
          >
            ▲
          </button>
          <button
            type='button'
            className='profile-arrange__step'
            onPointerDown={swallow}
            onClick={handleDown}
            disabled={index === total - 1}
            aria-label={intl.formatMessage(messages.moveDown)}
          >
            ▼
          </button>
          <button
            type='button'
            className='profile-arrange__action'
            onPointerDown={swallow}
            onClick={handleChoose}
          >
            {intl.formatMessage(messages.choose)}
          </button>
          <button
            type='button'
            className='profile-arrange__action profile-arrange__action--off'
            onPointerDown={swallow}
            onClick={handleRemove}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        </div>
      </div>
      <ShelfDrawn accountId={accountId} section={section} />
    </li>
  );
};

interface KornerPreset {
  korner_slug: string;
  name: string;
  card: string;
  count: number;
}

// Its own component so the add handler is a stable callback bound to the
// preset, rather than an arrow rebuilt inside the map on every render.
const ChoiceRow: React.FC<{
  preset: KornerPreset;
  onAdd: (preset: KornerPreset) => void;
}> = ({ preset, onAdd }) => {
  const intl = useIntl();
  const handleAdd = useCallback(() => {
    onAdd(preset);
  }, [onAdd, preset]);

  return (
    <li>
      <button
        type='button'
        className='profile-arrange__choice'
        onClick={handleAdd}
      >
        <span className='profile-arrange__choice-name'>{preset.name}</span>
        <span className='profile-arrange__choice-count'>
          {intl.formatMessage(messages.addCount, { count: preset.count })}
        </span>
      </button>
    </li>
  );
};

interface AddKornerProps {
  sections: ApiProfileSectionJSON[];
  onAdd: (preset: KornerPreset) => void;
}

const AddKorner: React.FC<AddKornerProps> = ({ sections, onAdd }) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<ApiProfileLibraryJSON | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void apiGetProfileLibrary()
      .then((data) => {
        if (!cancelled) setLibrary(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLibrary({ told: [], drawn: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const add = useCallback(
    (preset: KornerPreset) => {
      setOpen(false);
      onAdd(preset);
    },
    [onAdd],
  );

  // Only korners this person has actually posted in. A profile is built from
  // what you have made, so an empty korner in the list is an invitation to a
  // shelf that would render nothing.
  //
  // Matched against the korners currently ON the profile, not every shelf
  // row that exists. Taking one off leaves a hidden row behind, and matching
  // on those would drop it out of this list too — off would be permanent.
  const onSlugs = new Set(
    sections
      .filter((s) => s.visible)
      .map(kornerSlugOf)
      .filter(Boolean),
  );
  const choices = (library?.drawn ?? []).filter(
    (preset) => preset.count > 0 && !onSlugs.has(preset.korner_slug),
  );

  return (
    <>
      <button
        type='button'
        className='profile-arrange__add'
        onClick={handleOpen}
      >
        <span className='profile-arrange__add-plus' aria-hidden>
          +
        </span>
        {intl.formatMessage(messages.add)}
      </button>

      {open && (
        <div
          className='profile-shelves__composer-scrim'
          role='dialog'
          aria-modal
          aria-label={intl.formatMessage(messages.addTitle)}
        >
          <div className='profile-shelves__composer profile-arrange__sheet'>
            <header className='profile-shelves__composer-head'>
              <h2 className='profile-shelves__composer-title'>
                {intl.formatMessage(messages.addTitle)}
              </h2>
            </header>
            <p className='profile-shelves__composer-hint'>
              {intl.formatMessage(messages.addLede)}
            </p>

            {library === null ? null : choices.length === 0 ? (
              <p className='profile-shelves__composer-hint'>
                {intl.formatMessage(messages.addEmpty)}
              </p>
            ) : (
              <ul className='profile-arrange__choices'>
                {choices.map((preset) => (
                  <ChoiceRow
                    key={preset.korner_slug}
                    preset={preset}
                    onAdd={add}
                  />
                ))}
              </ul>
            )}

            <div className='profile-shelves__composer-actions'>
              <button
                type='button'
                className='profile-shelves__composer-cancel'
                onClick={handleClose}
              >
                {intl.formatMessage(messages.cancel)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface ArrangeStackProps {
  accountId: string;
  sections: ApiProfileSectionJSON[];
  onChange: (sections: ApiProfileSectionJSON[]) => void;
}

export const ArrangeStack: React.FC<ArrangeStackProps> = ({
  accountId,
  sections,
  onChange,
}) => {
  const intl = useIntl();
  const [picking, setPicking] = useState<ApiProfileSectionJSON | null>(null);

  const sensors = useSensors(
    // A mouse drags on contact; a finger has to hold first, or the page
    // cannot be scrolled past a shelf.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: HOLD_MS, tolerance: HOLD_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const shown = sections.filter((s) => s.visible);

  // The reorder endpoint sets position = index for every id it is given, so
  // the hidden shelves have to travel with the visible ones or they all
  // collapse onto position 0 and the next drag shuffles them.
  const persistOrder = useCallback(
    (nextShown: ApiProfileSectionJSON[]) => {
      const hidden = sections.filter((s) => !s.visible);
      const next = [...nextShown, ...hidden];
      onChange(next);
      void apiReorderProfileSections(next.map((s) => s.id)).catch(() => {
        onChange(sections);
      });
    },
    [onChange, sections],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = shown.findIndex((s) => s.id === active.id);
      const to = shown.findIndex((s) => s.id === over.id);
      if (from < 0 || to < 0) return;

      const next = [...shown];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      persistOrder(next);
    },
    [shown, persistOrder],
  );

  const move = useCallback(
    (section: ApiProfileSectionJSON, delta: 1 | -1) => {
      const from = shown.findIndex((s) => s.id === section.id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= shown.length) return;
      const next = [...shown];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(to, 0, moved);
      persistOrder(next);
    },
    [shown, persistOrder],
  );

  // Taking a korner off the profile hides the shelf; it never deletes it, and
  // the curation on it survives being put back.
  const remove = useCallback(
    (section: ApiProfileSectionJSON) => {
      onChange(
        sections.map((s) =>
          s.id === section.id ? { ...s, visible: false } : s,
        ),
      );
      void apiUpdateProfileSection(section.id, { visible: false }).catch(() => {
        onChange(sections);
      });
    },
    [onChange, sections],
  );

  // Putting a korner back is the same gesture as adding it for the first
  // time. A shelf that was taken off still exists, with its curation intact,
  // so this shows it again rather than building a second shelf onto the same
  // korner.
  const add = useCallback(
    (preset: KornerPreset) => {
      const existing = sections.find(
        (s) => kornerSlugOf(s) === preset.korner_slug,
      );

      if (existing) {
        onChange(
          sections.map((s) =>
            s.id === existing.id ? { ...s, visible: true } : s,
          ),
        );
        void apiUpdateProfileSection(existing.id, { visible: true }).catch(
          () => {
            onChange(sections);
          },
        );
        return;
      }

      void apiCreateProfileSection({
        section_type: 'drawn',
        title: preset.name,
        settings: {
          render: preset.card,
          korner_slug: preset.korner_slug,
          order: 'newest',
        },
      })
        .then((created) => {
          onChange([...sections, created]);
          return undefined;
        })
        .catch(() => undefined);
    },
    [onChange, sections],
  );

  const saved = useCallback(
    (updated: ApiProfileSectionJSON) => {
      setPicking(null);
      onChange(sections.map((s) => (s.id === updated.id ? updated : s)));
    },
    [onChange, sections],
  );

  const closePicker = useCallback(() => {
    setPicking(null);
  }, []);

  return (
    <div className='profile-arrange'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={shown.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className='profile-arrange__stack'>
            {shown.map((section, i) => (
              <SortableShelf
                key={section.id}
                accountId={accountId}
                section={section}
                index={i}
                total={shown.length}
                onChoose={setPicking}
                onRemove={remove}
                onMove={move}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {shown.length === 0 && (
        <p className='profile-arrange__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      <AddKorner sections={sections} onAdd={add} />

      {picking && (
        <PostPicker section={picking} onSaved={saved} onCancel={closePicker} />
      )}
    </div>
  );
};
