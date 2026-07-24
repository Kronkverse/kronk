import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useHistory, Link } from 'react-router-dom';

import { apiCreateKrew } from 'mastodon/api/krew';
import type { KrewAccess } from 'mastodon/api/krew';
import { Stage } from 'mastodon/components/stage';

// Start a Krew (/hub/krew/new) per KRONK_KREWS §7.4. This 4a version
// covers the identity + access sub-forms; Korner attachments, invite
// members, and the requirement builder for `requirement_gated` come
// with 4b (the endpoints for accretion / requirement writes still
// need to land).

const messages = defineMessages({
  title: { id: 'krew.new.title', defaultMessage: 'Start a Krew' },
  back: { id: 'krew.new.back', defaultMessage: '← Cancel' },
  intro: {
    id: 'krew.new.intro',
    defaultMessage:
      'A Krew is a defined group of people you can share with selectively. You seed it — no admin tier, no moderation, no removal power. Members join and leave freely.',
  },
  identity: { id: 'krew.new.identity', defaultMessage: 'Identity' },
  name: { id: 'krew.new.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'krew.new.name_placeholder',
    defaultMessage: 'What are these people?',
  },
  slug: { id: 'krew.new.slug', defaultMessage: 'URL slug' },
  slugHint: {
    id: 'krew.new.slug_hint',
    defaultMessage:
      'Lowercase, hyphens. Auto-generated from the name — edit if you want.',
  },
  description: { id: 'krew.new.description', defaultMessage: 'Description' },
  descriptionPlaceholder: {
    id: 'krew.new.description_placeholder',
    defaultMessage: "What's this Krew for?",
  },
  access: { id: 'krew.new.access', defaultMessage: 'Access' },
  accessOpen: {
    id: 'krew.new.access_open',
    defaultMessage: 'Open — anyone can find and join',
  },
  accessInviteOnly: {
    id: 'krew.new.access_invite',
    defaultMessage: 'Invite-only — hidden; join by invite link only',
  },
  accessGated: {
    id: 'krew.new.access_gated',
    defaultMessage: 'Requirement-gated — findable, but join is gated',
  },
  gatedDeferred: {
    id: 'krew.new.gated_deferred',
    defaultMessage:
      'Requirement rules can be added after creation (attending an event / located in a region / vouched by a member).',
  },
  create: { id: 'krew.new.create', defaultMessage: 'Plant it' },
  creating: { id: 'krew.new.creating', defaultMessage: 'Planting…' },
});

const slugify = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const KrewNew = () => {
  const intl = useIntl();
  const history = useHistory();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [access, setAccess] = useState<KrewAccess>('open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugTouched ? slug : derivedSlug;

  const handleNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setName(e.target.value);
  }, []);

  const handleSlugChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setSlug(slugify(e.target.value));
    setSlugTouched(true);
  }, []);

  const handleDescriptionChange = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setDescription(e.target.value);
  }, []);

  const handleAccessChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    setAccess(e.target.value as KrewAccess);
  }, []);

  const canSubmit = name.trim().length > 0 && effectiveSlug.length > 0 && !busy;

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const created = await apiCreateKrew({
        slug: effectiveSlug,
        name: name.trim(),
        description: description.trim() || undefined,
        access,
      });
      history.push(`/hub/krew/${created.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [access, description, effectiveSlug, history, name]);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>(
    (e) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <div className='scrollable groups-page'>
        <Link to='/hub/krew' className='group-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>

        <h1 className='groups-page__form-title'>
          <FormattedMessage {...messages.title} />
        </h1>
        <p className='groups-page__intro'>
          {intl.formatMessage(messages.intro)}
        </p>

        <form onSubmit={handleSubmit} className='groups-page__form'>
          <fieldset>
            <legend>{intl.formatMessage(messages.identity)}</legend>

            <label>
              {intl.formatMessage(messages.name)}
              <input
                type='text'
                value={name}
                onChange={handleNameChange}
                placeholder={intl.formatMessage(messages.namePlaceholder)}
                required
              />
            </label>

            <label>
              {intl.formatMessage(messages.slug)}
              <input
                type='text'
                value={effectiveSlug}
                onChange={handleSlugChange}
                pattern='[a-z][a-z0-9-]*'
              />
              <small>{intl.formatMessage(messages.slugHint)}</small>
            </label>

            <label>
              {intl.formatMessage(messages.description)}
              <textarea
                value={description}
                onChange={handleDescriptionChange}
                placeholder={intl.formatMessage(
                  messages.descriptionPlaceholder,
                )}
                rows={3}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>{intl.formatMessage(messages.access)}</legend>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='open'
                checked={access === 'open'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessOpen)}
            </label>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='invite_only'
                checked={access === 'invite_only'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessInviteOnly)}
            </label>

            <label className='groups-page__form-radio'>
              <input
                type='radio'
                name='access'
                value='requirement_gated'
                checked={access === 'requirement_gated'}
                onChange={handleAccessChange}
              />
              {intl.formatMessage(messages.accessGated)}
            </label>

            {access === 'requirement_gated' && (
              <p className='groups-page__form-note'>
                {intl.formatMessage(messages.gatedDeferred)}
              </p>
            )}
          </fieldset>

          {error && <p className='groups-page__error'>{error}</p>}

          <button
            type='submit'
            disabled={!canSubmit}
            className='groups-page__form-submit'
          >
            {busy
              ? intl.formatMessage(messages.creating)
              : intl.formatMessage(messages.create)}
          </button>
        </form>
      </div>
    </Stage>
  );
};
