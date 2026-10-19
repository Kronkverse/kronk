import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiDeleteFilm } from 'mastodon/api/cinema';
import type { ApiFilmJSON } from 'mastodon/api_types/cinema';
import { Avatar } from 'mastodon/components/avatar';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { FilmComposer } from './film_composer';

const messages = defineMessages({
  editFilm: { id: 'cinema.page_action.edit', defaultMessage: 'Edit film' },
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

export const FilmViewer: React.FC<Props> = ({ film, onChange }) => {
  const intl = useIntl();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const history = useHistory();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit lives in the Ж menu (docs/design.md): the owner gets an Edit
  // film moon, opening the create composer in edit mode. Delete sits at
  // the foot of that form; there is no inline Edit or Delete here.
  const handleStartEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);
  const handleUpdated = useCallback(
    (updated: ApiFilmJSON) => {
      onChange?.(updated);
      setEditing(false);
    },
    [onChange],
  );
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.editFilm),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleStartEdit,
    film.is_owner && !editing,
  );

  const handleDelete = useCallback(() => {
    if (deleting) return;
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setDeleting(true);
      void (async () => {
        try {
          await apiDeleteFilm(film.id);
          history.replace('/hub/cinema');
        } catch {
          setDeleting(false);
        }
      })();
    });
  }, [deleting, intl, film.id, history, confirmThen]);

  const ownerAccount = createAccountFromServerJSON(film.owner);

  return (
    <article className='cinema-viewer'>
      {confirmDialog}
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

      {editing && (
        <FilmComposer
          film={film}
          onCancel={handleEditCancel}
          onUpdated={handleUpdated}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </article>
  );
};
