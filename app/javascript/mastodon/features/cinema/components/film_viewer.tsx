import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiDeleteFilm } from 'mastodon/api/cinema';
import type { ApiFilmJSON } from 'mastodon/api_types/cinema';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  deleteFilm: { id: 'cinema.viewer.delete', defaultMessage: 'Delete film' },
  deleteConfirm: {
    id: 'cinema.viewer.delete_confirm',
    defaultMessage: 'Delete this film? This is permanent.',
  },
  missingVideo: {
    id: 'cinema.viewer.missing_video',
    defaultMessage: 'This film’s video is no longer available.',
  },
  description: {
    id: 'cinema.viewer.description',
    defaultMessage: 'About this film',
  },
  visibilityPublic: {
    id: 'cinema.viewer.visibility_public',
    defaultMessage: 'Kronk',
  },
  visibilityOrbit: {
    id: 'cinema.viewer.visibility_orbit',
    defaultMessage: 'Orbit',
  },
  visibilityMates: {
    id: 'cinema.viewer.visibility_mates',
    defaultMessage: 'Mates',
  },
  visibilitySelfOnly: {
    id: 'cinema.viewer.visibility_self_only',
    defaultMessage: 'Just me',
  },
});

const VISIBILITY_LABEL = {
  public: messages.visibilityPublic,
  orbit: messages.visibilityOrbit,
  mates: messages.visibilityMates,
  self_only: messages.visibilitySelfOnly,
} as const;

interface Props {
  film: ApiFilmJSON;
  onChange?: (film: ApiFilmJSON) => void;
}

export const FilmViewer: React.FC<Props> = ({ film }) => {
  const intl = useIntl();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    if (!window.confirm(intl.formatMessage(messages.deleteConfirm))) return;
    setDeleting(true);
    void (async () => {
      try {
        await apiDeleteFilm(film.id);
        history.replace('/hub/cinema');
      } catch {
        setDeleting(false);
      }
    })();
  }, [deleting, intl, film.id, history]);

  const ownerAccount = createAccountFromServerJSON(film.owner);

  return (
    <article className='cinema-viewer'>
      <header className='cinema-viewer__header'>
        <h1 className='cinema-viewer__title'>{film.title}</h1>
        <div className='cinema-viewer__meta'>
          <span>{intl.formatMessage(VISIBILITY_LABEL[film.visibility])}</span>
        </div>
        <div className='cinema-viewer__owner'>
          <Avatar account={ownerAccount} size={24} />
          <span>@{film.owner.acct}</span>
        </div>
      </header>

      {film.video_url ? (
        // Captions aren't authored yet — the composer doesn't capture
        // a track file, and adding a mandatory-caption gate before the
        // korner has any usage is premature. When a captions UX lands,
        // remove the disable + add a <track kind='captions'>.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          className='cinema-viewer__player'
          src={film.video_url}
          controls
          playsInline
        />
      ) : (
        <p className='cinema-viewer__missing'>
          {intl.formatMessage(messages.missingVideo)}
        </p>
      )}

      {film.description && (
        <section className='cinema-viewer__description'>
          <h2>{intl.formatMessage(messages.description)}</h2>
          <p>{film.description}</p>
        </section>
      )}

      {film.is_owner && (
        <footer className='cinema-viewer__actions'>
          <button
            type='button'
            className='cinema-viewer__delete'
            onClick={handleDelete}
            disabled={deleting}
          >
            {intl.formatMessage(messages.deleteFilm)}
          </button>
        </footer>
      )}
    </article>
  );
};
