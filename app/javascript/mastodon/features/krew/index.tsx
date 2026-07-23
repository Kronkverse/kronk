import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiGetKrews, apiCreateKrew } from 'mastodon/api/krew';
import type { ApiKrewJSON } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// User-facing copy: Krews is Kronk's audience-scoping primitive (see
// docs/spaces/krew_build_spec.md). CSS class names still say
// `groups-page__*` — those flip in a follow-up SCSS-only sweep so this
// rename doesn't churn styling in the same PR.
const messages = defineMessages({
  title: { id: 'krew.title', defaultMessage: 'Krews' },
});

type Scope = 'mine' | 'discoverable' | 'all';

const SCOPE_LABELS: [Scope, string][] = [
  ['mine', 'My krews'],
  ['discoverable', 'Discoverable'],
  ['all', 'All'],
];

export const Krews = () => {
  const intl = useIntl();
  const [krews, setKrews] = useState<ApiKrewJSON[]>([]);
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
        const data = await apiGetKrews({
          limit: 40,
          scope: nextScope ?? scope,
        });
        setKrews(data);
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
      await apiCreateKrew(form);
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
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable groups-page'>
        <p className='groups-page__intro'>
          <FormattedMessage
            id='krew.intro'
            defaultMessage='Krews are shareable multi-poster spaces. Seeders plant them; membership is opt-in. Choose a governance framework at creation to shape how structural changes get enacted.'
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
            <FormattedMessage id='krew.cancel_create' defaultMessage='Cancel' />
          ) : (
            <FormattedMessage
              id='krew.new'
              defaultMessage='+ Plant a new krew'
            />
          )}
        </button>

        {creating && (
          <div className='groups-page__form'>
            <h3>
              <FormattedMessage
                id='krew.plant_title'
                defaultMessage='Plant a new krew'
              />
            </h3>

            <label>
              <FormattedMessage
                id='krew.form.slug'
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
              <FormattedMessage id='krew.form.name' defaultMessage='Name' />
              <input
                type='text'
                data-field='name'
                value={form.name}
                onChange={handleFieldChange}
              />
            </label>

            <label>
              <FormattedMessage
                id='krew.form.description'
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
                id='krew.form.governance'
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
                id='krew.form.discoverable'
                defaultMessage='List this krew in the public discovery page'
              />
            </label>

            <button type='button' onClick={handleSubmitCreate}>
              <FormattedMessage id='krew.plant' defaultMessage='Plant it' />
            </button>
          </div>
        )}

        {error && <p className='groups-page__error'>{error}</p>}

        {loading && (
          <p className='groups-page__loading'>
            <FormattedMessage id='krew.loading' defaultMessage='Loading…' />
          </p>
        )}

        {!loading && krews.length === 0 && (
          <p className='groups-page__empty'>
            <FormattedMessage
              id='krew.empty'
              defaultMessage='No krews here. Try another scope or plant one.'
            />
          </p>
        )}

        <ul className='groups-page__list'>
          {krews.map((k) => (
            <li key={k.id} className='groups-page__row'>
              <Link to={`/hub/krew/${k.id}`}>
                <div className='groups-page__row-header'>
                  <h3 className='groups-page__row-name'>{k.name}</h3>
                  <small className='groups-page__row-slug'>@{k.slug}</small>
                  {k.viewer_role === 'seeder' && (
                    <span className='groups-page__chip groups-page__chip--seeder'>
                      seeder
                    </span>
                  )}
                  {k.viewer_role === 'member' && (
                    <span className='groups-page__chip'>member</span>
                  )}
                </div>
                {k.description && (
                  <p className='groups-page__row-desc'>{k.description}</p>
                )}
                <small className='groups-page__row-meta'>
                  {k.member_count} members · governance:{' '}
                  {k.governance_framework}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
};
