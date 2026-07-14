import { useEffect, useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  fetchProfileSections,
  reorderProfileSections,
} from 'mastodon/actions/profile_sections';
import { apiRequestGet } from 'mastodon/api';
import {
  apiCreateProfileSection,
  apiDeleteProfileSection,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import { useProfileSections } from 'mastodon/hooks/useProfileSections';
import { useAppDispatch } from 'mastodon/store';

// Draggable row wrapper — one section, drag handle on the left.
const SortableSectionRow: React.FC<{
  section: ApiProfileSectionJSON;
  onToggleVisible: (id: string, visible: boolean) => void;
  onRemove: (id: string) => void;
}> = ({ section, onToggleVisible, onRemove }) => {
  const handleToggle = useCallback(() => {
    onToggleVisible(section.id, section.visible);
  }, [section.id, section.visible, onToggleVisible]);
  const handleRemove = useCallback(() => {
    onRemove(section.id);
  }, [section.id, onRemove]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-medium, 8px)',
        marginBottom: '0.5rem',
        background: 'var(--surface-elevated)',
        opacity: section.visible ? (isDragging ? 0.7 : 1) : 0.5,
        cursor: 'default',
      }}
    >
      <span
        {...attributes}
        {...listeners}
        aria-label='Drag to reorder'
        style={{
          cursor: 'grab',
          padding: '0 0.4rem',
          color: 'var(--text-muted)',
          userSelect: 'none',
        }}
      >
        ⋮⋮
      </span>
      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
        {section.section_type}
      </span>
      <span style={{ flex: 1 }}>{section.title ?? '—'}</span>
      <button
        type='button'
        onClick={handleToggle}
      >
        {section.visible ? 'Hide' : 'Show'}
      </button>
      {section.section_type !== 'timeline' && (
        <button type='button' onClick={handleRemove}>
          Remove
        </button>
      )}
    </li>
  );
};

interface KategoryJSON {
  name: string;
}

const messages = defineMessages({
  title: { id: 'profile_sections.title', defaultMessage: 'Profile sections' },
});

export const ProfileSectionsSettings = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const sections = useProfileSections();
  const korners = useAllKorners();

  useEffect(() => {
    void dispatch(fetchProfileSections());
  }, [dispatch]);

  const refetch = useCallback(() => {
    void dispatch(fetchProfileSections());
  }, [dispatch]);

  // dnd-kit setup for drag-to-reorder.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const order = arrayMove(sections, oldIndex, newIndex).map((s) => s.id);
      void dispatch(reorderProfileSections({ order }));
    },
    [dispatch, sections],
  );

  const toggleVisible = useCallback(
    async (id: string, visible: boolean) => {
      await apiUpdateProfileSection(id, { visible: !visible });
      refetch();
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      await apiDeleteProfileSection(id);
      refetch();
    },
    [refetch],
  );

  const addKornerSection = useCallback(
    async (slug: string, name: string) => {
      await apiCreateProfileSection({
        section_type: 'korner',
        title: name,
        settings: { korner_slug: slug },
      });
      refetch();
    },
    [refetch],
  );

  const [kategories, setKategories] = useState<KategoryJSON[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiRequestGet<KategoryJSON[]>('v1/kategories');
        setKategories(data);
      } catch {
        // Kategories are optional — silent failure keeps the UI usable.
      }
    })();
  }, []);

  const addKategorySection = useCallback(
    async (tagName: string) => {
      const title = tagName.charAt(0).toUpperCase() + tagName.slice(1);
      await apiCreateProfileSection({
        section_type: 'kategory',
        title,
        settings: { tag_name: tagName },
      });
      refetch();
    },
    [refetch],
  );

  const handleToggleVisible = useCallback(
    (id: string, visible: boolean) => { void toggleVisible(id, visible); },
    [toggleVisible],
  );
  const handleRemove = useCallback(
    (id: string) => { void remove(id); },
    [remove],
  );
  const handleAddKorner = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const slug = e.currentTarget.dataset.slug;
      const name = e.currentTarget.dataset.name;
      if (slug && name) void addKornerSection(slug, name);
    },
    [addKornerSection],
  );
  const handleAddKategory = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const name = e.currentTarget.dataset.name;
      if (name) void addKategorySection(name);
    },
    [addKategorySection],
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader title={intl.formatMessage(messages.title)} showBackButton />

      <div className='scrollable' style={{ padding: '1rem' }}>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          <FormattedMessage
            id='profile_sections.help'
            defaultMessage='Arrange the sections that appear on your profile. Every profile starts with a Timeline section; add korner or kategory sections to surface specific slices of what you post.'
          />
        </p>

        <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
          <FormattedMessage
            id='profile_sections.your_sections'
            defaultMessage='Your sections'
          />
        </h3>

        {sections.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage
              id='profile_sections.empty'
              defaultMessage='Loading…'
            />
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol style={{ padding: 0, listStyle: 'none' }}>
              {sections.map((s) => (
                <SortableSectionRow
                  key={s.id}
                  section={s}
                  onToggleVisible={handleToggleVisible}
                  onRemove={handleRemove}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>
          <FormattedMessage
            id='profile_sections.add_korner'
            defaultMessage='Add a korner section'
          />
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {korners
            .filter((k) => k.enforced && k.slug !== 'nudges')
            .map((k) => (
              <button
                key={k.slug}
                type='button'
                data-slug={k.slug}
                data-name={k.name}
                onClick={handleAddKorner}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-round, 999px)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--surface-elevated)',
                  cursor: 'pointer',
                }}
              >
                + {k.name}
              </button>
            ))}
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>
          <FormattedMessage
            id='profile_sections.add_kategory'
            defaultMessage='Add a kategory section'
          />
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {kategories.map((k) => (
            <button
              key={k.name}
              type='button'
              data-name={k.name}
              onClick={handleAddKategory}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-round, 999px)',
                border: '1px solid var(--border-default)',
                background: 'var(--surface-elevated)',
                cursor: 'pointer',
              }}
            >
              + #{k.name}
            </button>
          ))}
          {kategories.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>
              <FormattedMessage
                id='profile_sections.no_kategories'
                defaultMessage='No curated kategories seeded yet. Run bin/tootctl kategories seed on this instance.'
              />
            </p>
          )}
        </div>
      </div>
    </Column>
  );
};

