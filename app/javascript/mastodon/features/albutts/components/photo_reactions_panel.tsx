import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import HeartFillIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import HeartIcon from '@/material-icons/400-24px/favorite.svg?react';
import ReplyIcon from '@/material-icons/400-24px/reply.svg?react';
import { apiRequestPost } from 'mastodon/api';
import type {
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { Icon } from 'mastodon/components/icon';

// Photo reactions rail — the interaction surface for a single
// AlbumPhoto, rendered inside the lightbox. Since 2026-07-31 each
// AlbumPhoto is a thin join over a Status, so favourites and replies
// ride the standard Mastodon endpoints. The froth button toggles the
// linked Status's favourite; the "View thread" link opens the
// status's permalink where the whole reply chain lives.

const messages = defineMessages({
  froth: { id: 'albutts.reactions.froth', defaultMessage: 'Froth' },
  frothed: { id: 'albutts.reactions.frothed', defaultMessage: 'Frothed' },
  viewThread: {
    id: 'albutts.reactions.view_thread',
    defaultMessage: 'View thread',
  },
});

interface PhotoReactionsPanelProps {
  photo: ApiAlbumPhotoJSON;
  onPhotoUpdated?: (photo: ApiAlbumPhotoJSON) => void;
}

export const PhotoReactionsPanel: React.FC<PhotoReactionsPanelProps> = ({
  photo,
  onPhotoUpdated,
}) => {
  const intl = useIntl();
  const [status, setStatus] = useState<ApiStatusJSON>(photo.status);
  const [busy, setBusy] = useState(false);

  const applyStatusUpdate = useCallback(
    (next: ApiStatusJSON) => {
      setStatus(next);
      onPhotoUpdated?.({ ...photo, status: next });
    },
    [onPhotoUpdated, photo],
  );

  const toggleFroth = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const request = status.favorited
      ? apiRequestPost<ApiStatusJSON>(`v1/statuses/${status.id}/unfavourite`)
      : apiRequestPost<ApiStatusJSON>(`v1/statuses/${status.id}/favourite`);
    void request
      .then(applyStatusUpdate)
      .catch((err: unknown) => {
        console.warn('[albutts] froth toggle failed', err);
      })
      .finally(() => {
        setBusy(false);
      });
  }, [applyStatusUpdate, busy, status]);

  const threadHref = `/@${status.account.acct}/${status.id}`;
  const frothLabel = intl.formatMessage(
    status.favorited ? messages.frothed : messages.froth,
  );

  return (
    <div className='albutts-reactions'>
      <div className='albutts-reactions__actions'>
        <button
          type='button'
          className={`albutts-froth${status.favorited ? ' albutts-froth--on' : ''}`}
          onClick={toggleFroth}
          disabled={busy}
          aria-pressed={status.favorited}
          aria-label={frothLabel}
          title={frothLabel}
        >
          <Icon
            id='favourite'
            icon={status.favorited ? HeartFillIcon : HeartIcon}
          />
          <span className='albutts-froth__count'>
            {status.favorites_count}
          </span>
        </button>

        <a
          className='albutts-reactions__thread-link'
          href={threadHref}
          target='_blank'
          rel='noopener noreferrer'
        >
          <Icon id='reply' icon={ReplyIcon} />
          <span>
            {intl.formatMessage(messages.viewThread)}
            {status.replies_count > 0 && (
              <span className='albutts-reactions__thread-count'>
                {' '}
                · {status.replies_count}
              </span>
            )}
          </span>
        </a>
      </div>
    </div>
  );
};
