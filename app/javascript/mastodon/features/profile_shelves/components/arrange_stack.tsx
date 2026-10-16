import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { KornerGlyph } from 'mastodon/components/korner_glyph';

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
  menu: {
    id: 'profile_shelves.arrange.menu',
    defaultMessage: 'Options for {name}',
  },
  choose: {
    id: 'profile_shelves.arrange.choose',
    defaultMessage: 'Choose posts',
  },
  remove: {
    id: 'profile_shelves.arrange.remove',
    defaultMessage: 'Take off profile',
  },
  addTitle: {
    id: 'profile_shelves.arrange.korners_title',
    defaultMessage: 'Korners on your profile',
  },
  addLede: {
    id: 'profile_shelves.arrange.korners_lede',
    defaultMessage:
      'Tick the korners you want to share. Each shows as a shelf of its posts, and you choose which. Nothing is copied or moved.',
  },
  addEmpty: {
    id: 'profile_shelves.arrange.add_empty',
    defaultMessage: 'No korners to show yet.',
  },
  addCount: {
    id: 'profile_shelves.arrange.add_count',
    defaultMessage: '{count, plural, one {# post} other {# posts}}',
  },
  addNone: {
    id: 'profile_shelves.arrange.add_none',
    defaultMessage: 'Nothing posted yet',
  },
  empty: {
    id: 'profile_shelves.arrange.empty_tick',
    defaultMessage: 'Your profile is empty. Tick a korner below to start it.',
  },
});

const kornerSlugOf = (section: ApiProfileSectionJSON) =>
  section.settings.korner_slug as string | undefined;

interface ShelfMenuProps {
  section: ApiProfileSectionJSON;
  onChoose: (section: ApiProfileSectionJSON) => void;
  onRemove: (section: ApiProfileSectionJSON) => void;
}

// One button in the header rather than a row of them above it. Its press has
// to be swallowed before it reaches the header, or every tap on it is a hold
// waiting to lift the shelf.
const ShelfMenu: React.FC<ShelfMenuProps> = ({
  section,
  onChoose,
  onRemove,
}) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const swallow = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  const choose = useCallback(() => {
    setOpen(false);
    onChoose(section);
  }, [onChoose, section]);

  const remove = useCallback(() => {
    setOpen(false);
    onRemove(section);
  }, [onRemove, section]);

  const name = section.title ?? kornerSlugOf(section) ?? '';

  return (
    <span className='profile-arrange__menu'>
      <button
        type='button'
        className='profile-arrange__menu-button'
        onPointerDown={swallow}
        onClick={toggle}
        aria-expanded={open}
        aria-label={intl.formatMessage(messages.menu, { name })}
      >
        ⋯
      </button>
      {open && (
        <span className='profile-arrange__menu-items'>
          <button
            type='button'
            className='profile-arrange__menu-item'
            onPointerDown={swallow}
            onClick={choose}
          >
            {intl.formatMessage(messages.choose)}
          </button>
          <button
            type='button'
            className='profile-arrange__menu-item profile-arrange__menu-item--off'
            onPointerDown={swallow}
            onClick={remove}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        </span>
      )}
    </span>
  );
};

interface SortableShelfProps {
  accountId: string;
  section: ApiProfileSectionJSON;
  onChoose: (section: ApiProfileSectionJSON) => void;
  onRemove: (section: ApiProfileSectionJSON) => void;
  onSectionChange: (section: ApiProfileSectionJSON) => void;
}

// The shelf's own header is the handle. There is no arrange bar: a row of
// controls stacked above every shelf is furniture on a page whose whole point
// is to look like the profile. Hold the header — the thing already labelled
// "Albutts" — and the shelf lifts.
const SortableShelf: React.FC<SortableShelfProps> = ({
  accountId,
  section,
  onChoose,
  onRemove,
  onSectionChange,
}) => {
  const intl = useIntl();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const name = section.title ?? kornerSlugOf(section) ?? '';

  return (
    <li
      ref={setNodeRef}
      className={`profile-arrange__shelf${isDragging ? ' profile-arrange__shelf--lifted' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <ShelfDrawn
        accountId={accountId}
        section={section}
        arrange
        headerRef={setActivatorNodeRef}
        headerProps={{
          ...attributes,
          ...listeners,
          className: 'profile-shelves__shelf-head profile-arrange__head',
          'aria-label': intl.formatMessage(messages.grab, { name }),
        }}
        headerExtra={
          <ShelfMenu
            section={section}
            onChoose={onChoose}
            onRemove={onRemove}
          />
        }
        onSectionChange={onSectionChange}
      />
    </li>
  );
};

interface KornerPreset {
  korner_slug: string;
  name: string;
  card: string;
  count: number;
}

// One korner in the chooser: its glyph and name over what it would bring,
// ticked while its shelf is on the profile (the same tile Krew uses to pick
// its korners, `krew_composer.tsx`). Its own component so the toggle is a
// stable callback bound to the preset.
const KornerTile: React.FC<{
  preset: KornerPreset;
  on: boolean;
  onToggle: (preset: KornerPreset, on: boolean) => void;
}> = ({ preset, on, onToggle }) => {
  const intl = useIntl();
  const handleChange = useCallback(() => {
    onToggle(preset, on);
  }, [onToggle, preset, on]);

  return (
    <label
      className={`profile-arrange__korner${on ? ' profile-arrange__korner--on' : ''}`}
    >
      <input
        type='checkbox'
        checked={on}
        onChange={handleChange}
        className='profile-arrange__korner-input'
      />
      <KornerGlyph
        slug={preset.korner_slug}
        className='profile-arrange__korner-glyph'
        aria-hidden='true'
      />
      <span className='profile-arrange__korner-name'>{preset.name}</span>
      <span className='profile-arrange__korner-count'>
        {preset.count > 0
          ? intl.formatMessage(messages.addCount, { count: preset.count })
          : intl.formatMessage(messages.addNone)}
      </span>
    </label>
  );
};

interface KornerChooserProps {
  sections: ApiProfileSectionJSON[];
  onAdd: (preset: KornerPreset) => void;
  onRemove: (section: ApiProfileSectionJSON) => void;
}

// Which korners are on the profile, chosen from all of them at once (Tal
// 2026-10-15: actual options to choose from, as when adding korners to a
// Krew). It sits under the shelves while designing. Ticking one puts its
// shelf on; unticking takes it off, which hides the shelf and keeps what
// was chosen for it. A korner with nothing posted yet can be ticked, and
// its shelf shows once it has something.
const KornerChooser: React.FC<KornerChooserProps> = ({
  sections,
  onAdd,
  onRemove,
}) => {
  const intl = useIntl();
  const [library, setLibrary] = useState<ApiProfileLibraryJSON | null>(null);

  useEffect(() => {
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
  }, []);

  // Matched against the shelves currently ON the profile, not every shelf
  // row that exists. Taking one off leaves a hidden row behind, and
  // matching on those would mark it as still on.
  const onSections = useMemo(
    () =>
      new Map(
        sections
          .filter((s) => s.visible)
          .flatMap((s) => {
            const slug = kornerSlugOf(s);
            return slug ? [[slug, s] as const] : [];
          }),
      ),
    [sections],
  );

  const toggle = useCallback(
    (preset: KornerPreset, on: boolean) => {
      const section = on ? onSections.get(preset.korner_slug) : undefined;
      if (section) onRemove(section);
      else if (!on) onAdd(preset);
    },
    [onAdd, onRemove, onSections],
  );

  // The ones with something in them first, most first; then the rest.
  const choices = [...(library?.drawn ?? [])].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return (
    <section
      className='profile-arrange__korners'
      aria-label={intl.formatMessage(messages.addTitle)}
    >
      <h3 className='profile-arrange__korners-title'>
        {intl.formatMessage(messages.addTitle)}
      </h3>
      <p className='profile-arrange__korners-lede'>
        {intl.formatMessage(messages.addLede)}
      </p>

      {library === null ? null : choices.length === 0 ? (
        <p className='profile-arrange__korners-lede'>
          {intl.formatMessage(messages.addEmpty)}
        </p>
      ) : (
        <div className='profile-arrange__korner-grid'>
          {choices.map((preset) => (
            <KornerTile
              key={preset.korner_slug}
              preset={preset}
              on={onSections.has(preset.korner_slug)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}
    </section>
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
            {shown.map((section) => (
              <SortableShelf
                key={section.id}
                accountId={accountId}
                section={section}
                onChoose={setPicking}
                onRemove={remove}
                onSectionChange={saved}
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

      <KornerChooser sections={sections} onAdd={add} onRemove={remove} />

      {picking && (
        <PostPicker section={picking} onSaved={saved} onCancel={closePicker} />
      )}
    </div>
  );
};
