import { useEffect, useCallback, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useAppDispatch } from 'mastodon/store';
import {
  fetchProfileSections,
  reorderProfileSections,
} from 'mastodon/actions/profile_sections';
import {
  apiCreateProfileSection,
  apiDeleteProfileSection,
  apiUpdateProfileSection,
} from 'mastodon/api/profile_sections';
import { apiRequestGet } from 'mastodon/api';
import { useProfileSections } from 'mastodon/hooks/useProfileSections';
import { useAllKorners } from 'mastodon/hooks/useKorner';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';

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

  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const order = sections.map((s) => s.id);
      [order[index - 1], order[index]] = [order[index], order[index - 1]];
      void dispatch(reorderProfileSections({ order }));
    },
    [dispatch, sections],
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index === sections.length - 1) return;
      const order = sections.map((s) => s.id);
      [order[index], order[index + 1]] = [order[index + 1], order[index]];
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
          <FormattedMessage id='profile_sections.your_sections' defaultMessage='Your sections' />
        </h3>

        {sections.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage id='profile_sections.empty' defaultMessage='Loading…' />
          </p>
        )}

        <ol style={{ padding: 0, listStyle: 'none' }}>
          {sections.map((s, i) => (
            <li
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-medium, 8px)',
                marginBottom: '0.5rem',
                background: 'var(--surface-elevated)',
                opacity: s.visible ? 1 : 0.5,
              }}
            >
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {s.section_type}
              </span>
              <span style={{ flex: 1 }}>{s.title ?? '—'}</span>
              <button type='button' onClick={() => moveUp(i)} disabled={i === 0}>↑</button>
              <button type='button' onClick={() => moveDown(i)} disabled={i === sections.length - 1}>↓</button>
              <button type='button' onClick={() => void toggleVisible(s.id, s.visible)}>
                {s.visible ? 'Hide' : 'Show'}
              </button>
              {s.section_type !== 'timeline' && (
                <button type='button' onClick={() => void remove(s.id)}>Remove</button>
              )}
            </li>
          ))}
        </ol>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>
          <FormattedMessage id='profile_sections.add_korner' defaultMessage='Add a korner section' />
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {korners
            .filter((k) => k.enforced && k.slug !== 'nudges')
            .map((k) => (
              <button
                key={k.slug}
                type='button'
                onClick={() => void addKornerSection(k.slug, k.name)}
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
          <FormattedMessage id='profile_sections.add_kategory' defaultMessage='Add a kategory section' />
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {kategories.map((k) => (
            <button
              key={k.name}
              type='button'
              onClick={() => void addKategorySection(k.name)}
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
              <FormattedMessage id='profile_sections.no_kategories' defaultMessage='No curated kategories seeded yet. Run bin/tootctl kategories seed on this instance.' />
            </p>
          )}
        </div>
      </div>
    </Column>
  );
};

export default ProfileSectionsSettings;
