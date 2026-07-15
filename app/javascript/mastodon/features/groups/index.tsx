import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetGroups, apiCreateGroup } from 'mastodon/api/groups';
import type { ApiGroupJSON } from 'mastodon/api/groups';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

const messages = defineMessages({
  title: { id: 'groups.title', defaultMessage: 'Groups' },
});

type Scope = 'mine' | 'discoverable' | 'all';

const SCOPE_LABELS: [Scope, string][] = [
  ['mine', 'My groups'],
  ['discoverable', 'Discoverable'],
  ['all', 'All'],
];

export const Groups = () => {
  const intl = useIntl();
  const [groups, setGroups] = useState<ApiGroupJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('mine');
  const [form, setForm] = useState({
    slug: '',
    name: '',
    description: '',
    discoverable: true,
    governance_framework: 'peer_support',
  });

  const refetch = useCallback(
    async (nextScope?: Scope) => {
      setLoading(true);
      try {
        const data = await apiGetGroups({
          limit: 40,
          scope: nextScope ?? scope,
        });
        setGroups(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    void refetch();
  }, [scope, refetch]);

  const submitCreate = useCallback(async () => {
    setError(null);
    try {
      await apiCreateGroup(form);
      setForm({
        slug: '',
        name: '',
        description: '',
        discoverable: true,
        governance_framework: 'peer_support',
      });
      setCreating(false);
      await refetch();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [form, refetch]);

  // Stable handlers so JSX doesn't re-create arrows every render.
  const handleScopeClick = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >((e) => {
    const value = e.currentTarget.dataset.scope as Scope | undefined;
    if (value) setScope(value);
  }, []);

  const handleToggleCreating = useCallback(() => {
    setCreating((prev) => !prev);
  }, []);

  const handleFieldChange = useCallback<
    React.ChangeEventHandler<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  >((e) => {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    const value =
      e.currentTarget instanceof HTMLInputElement &&
      e.currentTarget.type === 'checkbox'
        ? e.currentTarget.checked
        : e.currentTarget.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmitCreate = useCallback(() => {
    void submitCreate();
  }, [submitCreate]);

  return (
    <Column bindToDocument label={intl.formatMessage(messages.title)}>
      <ColumnHeader title={intl.formatMessage(messages.title)} showBackButton />

      <div className='scrollable groups-page'>
        <p className='groups-page__intro'>
          <FormattedMessage
            id='groups.intro'
            defaultMessage='Groups are shareable multi-poster spaces. Seeders plant them; membership is opt-in. Choose a governance framework at creation to shape how structural changes get enacted.'
          />
        </p>

        <div className='groups-page__scope-tabs'>
          {SCOPE_LABELS.map(([value, label]) => (
            <button
              key={value}
              type='button'
              data-scope={value}
              onClick={handleScopeClick}
              className={`groups-page__scope-tab ${value === scope ? 'groups-page__scope-tab--active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type='button'
          onClick={handleToggleCreating}
          className='groups-page__new-btn'
        >
          {creating ? (
            <FormattedMessage
              id='groups.cancel_create'
              defaultMessage='Cancel'
            />
          ) : (
            <FormattedMessage
              id='groups.new'
              defaultMessage='+ Plant a new group'
            />
          )}
        </button>

        {creating && (
          <div className='groups-page__form'>
            <h3>
              <FormattedMessage
                id='groups.plant_title'
                defaultMessage='Plant a new group'
              />
            </h3>

            <label>
              <FormattedMessage
                id='groups.form.slug'
                defaultMessage='Slug (lowercase, hyphens ok)'
              />
              <input
                type='text'
                data-field='slug'
                value={form.slug}
                onChange={handleFieldChange}
              />
            </label>

            <label>
              <FormattedMessage id='groups.form.name' defaultMessage='Name' />
              <input
                type='text'
                data-field='name'
                value={form.name}
                onChange={handleFieldChange}
              />
            </label>

            <label>
              <FormattedMessage
                id='groups.form.description'
                defaultMessage='Description'
              />
              <textarea
                data-field='description'
                value={form.description}
                onChange={handleFieldChange}
                rows={3}
              />
            </label>

            <label>
              <FormattedMessage
                id='groups.form.governance'
                defaultMessage='Governance framework'
              />
              <select
                data-field='governance_framework'
                value={form.governance_framework}
                onChange={handleFieldChange}
              >
                <option value='peer_support'>
                  peer_support — one second required
                </option>
                <option value='two_key'>two_key — two seconds required</option>
                <option value='threshold'>
                  threshold — N supporters required
                </option>
                <option value='majority'>
                  majority — over half of members
                </option>
                <option value='consensus'>consensus — unanimous</option>
              </select>
            </label>

            <label className='groups-page__form-checkbox'>
              <input
                type='checkbox'
                data-field='discoverable'
                checked={form.discoverable}
                onChange={handleFieldChange}
              />
              <FormattedMessage
                id='groups.form.discoverable'
                defaultMessage='List this group in the public discovery page'
              />
            </label>

            <button type='button' onClick={handleSubmitCreate}>
              <FormattedMessage id='groups.plant' defaultMessage='Plant it' />
            </button>
          </div>
        )}

        {error && <p className='groups-page__error'>{error}</p>}

        {loading && (
          <p className='groups-page__loading'>
            <FormattedMessage id='groups.loading' defaultMessage='Loading…' />
          </p>
        )}

        {!loading && groups.length === 0 && (
          <p className='groups-page__empty'>
            <FormattedMessage
              id='groups.empty'
              defaultMessage='No groups here. Try another scope or plant one.'
            />
          </p>
        )}

        <ul className='groups-page__list'>
          {groups.map((g) => (
            <li key={g.id} className='groups-page__row'>
              <Link to={`/hub/groups/${g.id}`}>
                <div className='groups-page__row-header'>
                  <h3 className='groups-page__row-name'>{g.name}</h3>
                  <small className='groups-page__row-slug'>@{g.slug}</small>
                  {g.viewer_role === 'seeder' && (
                    <span className='groups-page__chip groups-page__chip--seeder'>
                      seeder
                    </span>
                  )}
                  {g.viewer_role === 'member' && (
                    <span className='groups-page__chip'>member</span>
                  )}
                </div>
                {g.description && (
                  <p className='groups-page__row-desc'>{g.description}</p>
                )}
                <small className='groups-page__row-meta'>
                  {g.member_count} members · governance:{' '}
                  {g.governance_framework}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Column>
  );
};
