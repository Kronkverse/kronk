import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateAlbum } from 'mastodon/api/albutts';
import type { AlbumVisibility, ApiAlbumJSON } from 'mastodon/api_types/albutts';

const messages = defineMessages({
  heading: {
    id: 'albutts.composer.heading',
    defaultMessage: 'Start an album',
  },
  titleLabel: {
    id: 'albutts.composer.title_label',
    defaultMessage: 'Title',
  },
  titlePlaceholder: {
    id: 'albutts.composer.title_placeholder',
    defaultMessage: 'What is this album?',
  },
  descriptionLabel: {
    id: 'albutts.composer.description_label',
    defaultMessage: 'Description (optional)',
  },
  visibilityLabel: {
    id: 'albutts.composer.visibility_label',
    defaultMessage: 'Who can see it?',
  },
  visibilityPublic: {
    id: 'albutts.composer.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityPublicHelp: {
    id: 'albutts.composer.visibility_public_help',
    defaultMessage: 'Everyone on Kronk',
  },
  visibilityOrbit: {
    id: 'albutts.composer.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityOrbitHelp: {
    id: 'albutts.composer.visibility_orbit_help',
    defaultMessage: 'Your mates and their mates',
  },
  visibilityMates: {
    id: 'albutts.composer.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilityMatesHelp: {
    id: 'albutts.composer.visibility_mates_help',
    defaultMessage: 'Your mutual connections only',
  },
  visibilitySelfOnly: {
    id: 'albutts.composer.visibility_self_only',
    defaultMessage: 'Just me',
  },
  visibilitySelfOnlyHelp: {
    id: 'albutts.composer.visibility_self_only_help',
    defaultMessage: 'On your profile only — not in anyone else’s feed',
  },
  visibilityKrew: {
    id: 'albutts.composer.visibility_krew',
    defaultMessage: 'A krew',
  },
  krewNote: {
    id: 'albutts.composer.krew_note',
    defaultMessage:
      'Krew-scoped albums are landing in a follow-up — pick a different scope for now.',
  },
  cancel: {
    id: 'albutts.composer.cancel',
    defaultMessage: 'Cancel',
  },
  create: {
    id: 'albutts.composer.create',
    defaultMessage: 'Create album',
  },
  error: {
    id: 'albutts.composer.error',
    defaultMessage: "Couldn't create — try again.",
  },
});

const TITLE_MAX = 240;
const DESCRIPTION_MAX = 4000;

interface AlbumComposerProps {
  onCancel: () => void;
  onCreated: (album: ApiAlbumJSON) => void;
}

export const AlbumComposer: React.FC<AlbumComposerProps> = ({
  onCancel,
  onCreated,
}) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<AlbumVisibility>('public');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = title.trim();
  const canSubmit = trimmed !== '' && !pending && visibility !== 'krew';

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value.slice(0, TITLE_MAX));
  }, []);

  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value.slice(0, DESCRIPTION_MAX));
    },
    [],
  );

  const handlePublic = useCallback(() => {
    setVisibility('public');
  }, []);
  const handleOrbit = useCallback(() => {
    setVisibility('orbit');
  }, []);
  const handleMates = useCallback(() => {
    setVisibility('mates');
  }, []);
  const handleSelfOnly = useCallback(() => {
    setVisibility('self_only');
  }, []);
  const handleKrew = useCallback(() => {
    setVisibility('krew');
  }, []);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const album = await apiCreateAlbum({
          title: trimmed,
          description: description.trim() || undefined,
          visibility,
        });
        onCreated(album);
      } catch {
        setError('create_failed');
        setPending(false);
      }
    })();
  }, [canSubmit, description, onCreated, trimmed, visibility]);

  return (
    <div className='albutts-composer' role='dialog' aria-modal='true'>
      <div className='albutts-composer__panel'>
        <h2 className='albutts-composer__heading'>
          {intl.formatMessage(messages.heading)}
        </h2>

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-title'
        >
          {intl.formatMessage(messages.titleLabel)}
        </label>
        <input
          id='albutts-composer-title'
          type='text'
          className='albutts-composer__input'
          value={title}
          onChange={handleTitle}
          maxLength={TITLE_MAX}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
        />

        <label
          className='albutts-composer__label'
          htmlFor='albutts-composer-description'
        >
          {intl.formatMessage(messages.descriptionLabel)}
        </label>
        <textarea
          id='albutts-composer-description'
          className='albutts-composer__textarea'
          value={description}
          onChange={handleDescription}
          maxLength={DESCRIPTION_MAX}
        />

        <div className='albutts-composer__label'>
          {intl.formatMessage(messages.visibilityLabel)}
        </div>
        <div className='albutts-composer__visibility'>
          <VisibilityOption
            active={visibility === 'public'}
            label={intl.formatMessage(messages.visibilityPublic)}
            help={intl.formatMessage(messages.visibilityPublicHelp)}
            onSelect={handlePublic}
          />
          <VisibilityOption
            active={visibility === 'orbit'}
            label={intl.formatMessage(messages.visibilityOrbit)}
            help={intl.formatMessage(messages.visibilityOrbitHelp)}
            onSelect={handleOrbit}
          />
          <VisibilityOption
            active={visibility === 'mates'}
            label={intl.formatMessage(messages.visibilityMates)}
            help={intl.formatMessage(messages.visibilityMatesHelp)}
            onSelect={handleMates}
          />
          <VisibilityOption
            active={visibility === 'self_only'}
            label={intl.formatMessage(messages.visibilitySelfOnly)}
            help={intl.formatMessage(messages.visibilitySelfOnlyHelp)}
            onSelect={handleSelfOnly}
          />
          <VisibilityOption
            active={visibility === 'krew'}
            label={intl.formatMessage(messages.visibilityKrew)}
            onSelect={handleKrew}
          />
        </div>
        {visibility === 'krew' && (
          <p className='albutts-composer__hint'>
            {intl.formatMessage(messages.krewNote)}
          </p>
        )}

        {error && (
          <p className='albutts-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}

        <div className='albutts-composer__actions'>
          <button
            type='button'
            className='albutts-btn albutts-btn--ghost'
            onClick={onCancel}
            disabled={pending}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            type='button'
            className='albutts-btn albutts-btn--primary'
            onClick={submit}
            disabled={!canSubmit}
          >
            {intl.formatMessage(messages.create)}
          </button>
        </div>
      </div>
    </div>
  );
};

interface VisibilityOptionProps {
  active: boolean;
  label: string;
  help?: string;
  onSelect: () => void;
}

const VisibilityOption: React.FC<VisibilityOptionProps> = ({
  active,
  label,
  help,
  onSelect,
}) => (
  <button
    type='button'
    className={`albutts-composer__visibility-opt ${active ? 'albutts-composer__visibility-opt--active' : ''}`}
    aria-pressed={active}
    aria-label={help ? `${label} — ${help}` : label}
    onClick={onSelect}
  >
    {label}
  </button>
);
