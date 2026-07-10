import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';

const messages = defineMessages({
  title: { id: 'sectioned_profile.title', defaultMessage: 'Profile' },
});

interface SectionWithStatuses extends ApiProfileSectionJSON {
  statuses: ApiStatusJSON[];
  loading: boolean;
}

export const SectionedProfile = () => {
  const intl = useIntl();
  const { acct } = useParams<{ acct?: string }>();

  const [account, setAccount] = useState<ApiAccountJSON | null>(null);
  const [sections, setSections] = useState<SectionWithStatuses[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!acct) return;

    let cancelled = false;
    void (async () => {
      try {
        const [accountRes] = await Promise.all([
          apiRequestGet<ApiAccountJSON>(`v1/accounts/lookup`, { acct }),
        ]);
        if (cancelled) return;
        setAccount(accountRes);

        const sectionList = await apiRequestGet<ApiProfileSectionJSON[]>(
          `v1/accounts/${accountRes.id}/profile/sections`,
        );
        if (cancelled) return;

        // Kick off status fetches in parallel for each section.
        const enriched: SectionWithStatuses[] = sectionList.map((s) => ({
          ...s,
          statuses: [],
          loading: true,
        }));
        setSections(enriched);

        await Promise.all(
          sectionList.map(async (s) => {
            const statuses = await apiRequestGet<ApiStatusJSON[]>(
              `v1/accounts/${accountRes.id}/profile/sections/${s.id}/statuses`,
              { limit: 20 },
            );
            if (cancelled) return;
            setSections((prev) =>
              prev.map((row) =>
                row.id === s.id ? { ...row, statuses, loading: false } : row,
              ),
            );
          }),
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [acct]);

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader
        title={account?.display_name ?? acct ?? intl.formatMessage(messages.title)}
        showBackButton
      />

      <div className='scrollable' style={{ padding: '1rem' }}>
        {error && (
          <p style={{ color: 'var(--warning-red, tomato)' }}>
            <FormattedMessage id='sectioned_profile.error' defaultMessage='Could not load profile.' />
            {' '}
            {error}
          </p>
        )}

        {!error && sections.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage id='sectioned_profile.loading' defaultMessage='Loading…' />
          </p>
        )}

        {sections.map((section) => (
          <section
            key={section.id}
            style={{
              marginBottom: '2rem',
              padding: '1rem',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-medium, 8px)',
              background: 'var(--surface-elevated)',
            }}
          >
            <header style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--accent)' }}>
                {section.title ?? section.section_type}
              </h3>
              <small style={{ color: 'var(--text-muted)' }}>{section.section_type}</small>
            </header>

            {section.loading && (
              <p style={{ color: 'var(--text-muted)' }}>
                <FormattedMessage id='sectioned_profile.loading_section' defaultMessage='Loading…' />
              </p>
            )}

            {!section.loading && section.statuses.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>
                <FormattedMessage id='sectioned_profile.empty' defaultMessage='Nothing here yet.' />
              </p>
            )}

            <ul style={{ padding: 0, listStyle: 'none' }}>
              {section.statuses.map((status) => (
                <li
                  key={status.id}
                  style={{
                    padding: '0.5rem 0',
                    borderTop: '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(status.created_at).toLocaleString()}
                  </div>
                  <div
                    style={{ marginTop: '0.25rem' }}
                    // Trusted markup — Status content comes from the Mastodon
                    // sanitiser before it reaches this component.
                    dangerouslySetInnerHTML={{ __html: status.content }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Column>
  );
};

export default SectionedProfile;
