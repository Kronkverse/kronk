import { useEffect } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { fetchNudgesLegacyArchive } from 'mastodon/actions/nudges_legacy';
import type { ApiNotificationJSON } from 'mastodon/api_types/notifications';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

const messages = defineMessages({
  title: { id: 'nudges.legacy.title', defaultMessage: 'Legacy archive' },
});

// Human-readable summary per notification type. Nudge is excluded
// from LEGACY_TYPES on the backend so we won't see it here.
const summaryFor = (n: ApiNotificationJSON) => {
  const actor = n.account?.acct ?? 'someone';
  switch (n.type) {
    case 'mention':
      return `${actor} mentioned you`;
    case 'reblog':
      return `${actor} reblogged your post`;
    case 'favourite':
      return `${actor} favourited your post`;
    case 'follow':
      return `${actor} followed you`;
    case 'follow_request':
      return `${actor} requested to follow you`;
    case 'poll':
      return `A poll you were in ended`;
    case 'update':
      return `${actor} edited a post`;
    case 'quote':
      return `${actor} quoted your post`;
    case 'quoted_update':
      return `${actor} edited a quote of your post`;
    case 'event_invitation':
      return `${actor} invited you to an event`;
    case 'media_tag':
      return `${actor} tagged you in media`;
    case 'severed_relationships':
    case 'moderation_warning':
    case 'annual_report':
      return `System notice: ${n.type.replaceAll('_', ' ')}`;
    default:
      return `${actor} — ${n.type}`;
  }
};

export const NudgesLegacyArchive = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();

  const { entries, loading, loaded } = useAppSelector((state) => {
    const s = state.get('nudges_legacy') as
      | { entries: ApiNotificationJSON[]; loading: boolean; loaded: boolean }
      | undefined;
    return s ?? { entries: [], loading: false, loaded: false };
  });

  useEffect(() => {
    void dispatch(fetchNudgesLegacyArchive({}));
  }, [dispatch]);

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader title={intl.formatMessage(messages.title)} showBackButton />

      <div className='scrollable' style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <Link
            to='/nudges'
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-round, 999px)',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <FormattedMessage id='nudges.tab.chats' defaultMessage='Chats' />
          </Link>
          <span
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-round, 999px)',
              background: 'var(--accent)',
              color: 'var(--surface-primary)',
            }}
          >
            <FormattedMessage id='nudges.tab.legacy' defaultMessage='Legacy' />
          </span>
        </div>

        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          <FormattedMessage
            id='nudges.legacy.intro'
            defaultMessage='Older notifications from the retired notifications bell. This archive is read-only and sunsets in 2.1.'
          />
        </p>

        {loading && !loaded && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage
              id='nudges.legacy.loading'
              defaultMessage='Loading…'
            />
          </p>
        )}

        {loaded && entries.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage
              id='nudges.legacy.empty'
              defaultMessage='No archived notifications.'
            />
          </p>
        )}

        <ol style={{ padding: 0, listStyle: 'none' }}>
          {entries.map((n) => (
            <li
              key={n.id}
              style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.4rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-medium, 8px)',
                background: 'var(--surface-elevated)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {new Date(n.created_at).toLocaleString()}
                {' · '}
                <code style={{ color: 'var(--accent)' }}>{n.type}</code>
              </span>
              <span>{summaryFor(n)}</span>
            </li>
          ))}
        </ol>
      </div>
    </Column>
  );
};

