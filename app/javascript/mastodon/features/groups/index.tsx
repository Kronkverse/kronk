import { useEffect, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';

import Column from 'mastodon/components/column';
import ColumnHeader from 'mastodon/components/column_header';
import { apiGetGroups, apiCreateGroup } from 'mastodon/api/groups';
import type { ApiGroupJSON } from 'mastodon/api/groups';

const messages = defineMessages({
  title: { id: 'groups.title', defaultMessage: 'Groups' },
});

export const Groups = () => {
  const intl = useIntl();
  const [groups, setGroups] = useState<ApiGroupJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    discoverable: true,
    governance_framework: 'peer_support',
  });

  const refetch = async () => {
    setLoading(true);
    try {
      const data = await apiGetGroups({ limit: 40 });
      setGroups(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  const submitCreate = async () => {
    setError(null);
    try {
      await apiCreateGroup(form);
      setForm({ slug: '', name: '', description: '', discoverable: true, governance_framework: 'peer_support' });
      setCreating(false);
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const chip = (label: string, kind: 'seeder' | 'member' | 'discoverable') => (
    <span
      style={{
        padding: '0.15rem 0.5rem',
        borderRadius: 'var(--radius-round, 999px)',
        fontSize: '0.7rem',
        background: kind === 'seeder' ? 'var(--accent)' : 'var(--surface-elevated)',
        color: kind === 'seeder' ? 'var(--surface-primary)' : 'var(--text-secondary)',
        border: kind === 'seeder' ? 'none' : '1px solid var(--border-default)',
        marginLeft: '0.4rem',
      }}
    >
      {label}
    </span>
  );

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader title={intl.formatMessage(messages.title)} showBackButton />

      <div className='scrollable' style={{ padding: '1rem' }}>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          <FormattedMessage
            id='groups.intro'
            defaultMessage='Groups are shareable multi-poster spaces. Seeders plant them; membership is opt-in. Choose a governance framework at creation to shape how structural changes get enacted.'
          />
        </p>

        <button
          type='button'
          onClick={() => setCreating((prev) => !prev)}
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-medium, 8px)',
            background: 'var(--accent)',
            color: 'var(--surface-primary)',
            cursor: 'pointer',
          }}
        >
          {creating ? (
            <FormattedMessage id='groups.cancel_create' defaultMessage='Cancel' />
          ) : (
            <FormattedMessage id='groups.new' defaultMessage='+ Plant a new group' />
          )}
        </button>

        {creating && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--surface-elevated)' }}>
            <h3 style={{ marginTop: 0 }}>
              <FormattedMessage id='groups.plant_title' defaultMessage='Plant a new group' />
            </h3>

            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <FormattedMessage id='groups.form.slug' defaultMessage='Slug (lowercase, hyphens ok)' />
              <input
                type='text'
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <FormattedMessage id='groups.form.name' defaultMessage='Name' />
              <input
                type='text'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <FormattedMessage id='groups.form.description' defaultMessage='Description' />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                style={{ display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <FormattedMessage id='groups.form.governance' defaultMessage='Governance framework' />
              <select
                value={form.governance_framework}
                onChange={(e) => setForm({ ...form, governance_framework: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
              >
                <option value='peer_support'>peer_support — one second required</option>
                <option value='two_key'>two_key — two seconds required</option>
                <option value='threshold'>threshold — N supporters required</option>
                <option value='majority'>majority — over half of members</option>
                <option value='consensus'>consensus — unanimous</option>
              </select>
            </label>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input
                type='checkbox'
                checked={form.discoverable}
                onChange={(e) => setForm({ ...form, discoverable: e.target.checked })}
              />
              <FormattedMessage id='groups.form.discoverable' defaultMessage='List this group in the public discovery page' />
            </label>

            <button
              type='button'
              onClick={() => void submitCreate()}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-medium, 8px)', background: 'var(--accent)', color: 'var(--surface-primary)', cursor: 'pointer' }}
            >
              <FormattedMessage id='groups.plant' defaultMessage='Plant it' />
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--warning-red, tomato)' }}>{error}</p>
        )}

        {loading && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage id='groups.loading' defaultMessage='Loading…' />
          </p>
        )}

        {!loading && groups.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            <FormattedMessage id='groups.empty' defaultMessage='No discoverable groups yet. Plant one above.' />
          </p>
        )}

        <ul style={{ padding: 0, listStyle: 'none' }}>
          {groups.map((g) => (
            <li
              key={g.id}
              style={{
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-medium, 8px)',
                background: 'var(--surface-elevated)',
              }}
            >
              <Link
                to={`/hub/groups/${g.id}`}
                style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, color: 'var(--accent)' }}>{g.name}</h3>
                  <small style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>@{g.slug}</small>
                  {g.viewer_role === 'seeder' && chip('seeder', 'seeder')}
                  {g.viewer_role === 'member' && chip('member', 'member')}
                </div>
                {g.description && (
                  <p style={{ margin: '0.4rem 0 0.2rem', color: 'var(--text-secondary)' }}>{g.description}</p>
                )}
                <small style={{ color: 'var(--text-muted)' }}>
                  {g.member_count} members · governance: {g.governance_framework}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Column>
  );
};

export default Groups;
