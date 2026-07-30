import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import HeartFillIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import HeartIcon from '@/material-icons/400-24px/favorite.svg?react';
import {
  apiCreatePhotoComment,
  apiDeletePhotoComment,
  apiFrothPhoto,
  apiListPhotoComments,
  apiUnfrothPhoto,
} from 'mastodon/api/albutts';
import type {
  ApiAlbumPhotoCommentJSON,
  ApiAlbumPhotoJSON,
} from 'mastodon/api_types/albutts';
import { Button } from 'mastodon/components/button';
import { Icon } from 'mastodon/components/icon';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

// Photo reactions rail — the interaction surface for a single AlbumPhoto,
// rendered inside the lightbox. Mirrors the Trek pattern
// (`features/map_v2/trek_froth.tsx` + `trek_comments.tsx`): a single
// froth toggle plus a comments section with a flat compose form and a
// list of comments below. Reactions federate at the photo level, not
// the album level — see docs/spaces/albutts.md §Lightbox + per-photo
// reactions.

const messages = defineMessages({
  froth: { id: 'albutts.reactions.froth', defaultMessage: 'Froth' },
  frothed: { id: 'albutts.reactions.frothed', defaultMessage: 'Frothed' },
  heading: { id: 'albutts.reactions.comments', defaultMessage: 'Comments' },
  placeholder: {
    id: 'albutts.reactions.placeholder',
    defaultMessage: 'Add a comment…',
  },
  reply: { id: 'albutts.reactions.reply', defaultMessage: 'Reply' },
  replyPlaceholder: {
    id: 'albutts.reactions.reply_placeholder',
    defaultMessage: 'Reply…',
  },
  post: { id: 'albutts.reactions.post', defaultMessage: 'Comment' },
  posting: { id: 'albutts.reactions.posting', defaultMessage: 'Posting…' },
  delete: { id: 'albutts.reactions.delete', defaultMessage: 'Delete' },
  cancel: { id: 'albutts.reactions.cancel', defaultMessage: 'Cancel' },
  empty: {
    id: 'albutts.reactions.empty',
    defaultMessage: 'No comments yet. Be the first.',
  },
});

const authorName = (
  account: ApiAlbumPhotoCommentJSON['account'],
): string =>
  account.display_name.length > 0 ? account.display_name : account.username;

interface PhotoReactionsPanelProps {
  photo: ApiAlbumPhotoJSON;
  onPhotoUpdated: (photo: ApiAlbumPhotoJSON) => void;
}

export const PhotoReactionsPanel: React.FC<PhotoReactionsPanelProps> = ({
  photo,
  onPhotoUpdated,
}) => {
  const intl = useIntl();
  const [comments, setComments] = useState<ApiAlbumPhotoCommentJSON[] | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setComments(null);
    apiListPhotoComments(photo.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  const toggleFroth = useCallback(() => {
    if (pending) return;
    setPending(true);
    const call = photo.frothed
      ? apiUnfrothPhoto(photo.id)
      : apiFrothPhoto(photo.id);
    call
      .then((updated) => {
        onPhotoUpdated(updated);
      })
      .catch(() => undefined)
      .finally(() => {
        setPending(false);
      });
  }, [pending, photo.frothed, photo.id, onPhotoUpdated]);

  const handleCommentPosted = useCallback(
    (comment: ApiAlbumPhotoCommentJSON) => {
      setComments((prev) => {
        const rows = prev ?? [];
        if (comment.parent_id) {
          return rows.map((root) => {
            if (root.id !== comment.parent_id) return root;
            return {
              ...root,
              replies: [...(root.replies ?? []), comment],
            };
          });
        }
        return [...rows, { ...comment, replies: comment.replies ?? [] }];
      });
      onPhotoUpdated({
        ...photo,
        comments_count: photo.comments_count + 1,
      });
      setReplyTo(null);
    },
    [onPhotoUpdated, photo],
  );

  const handleCommentDeleted = useCallback(
    (
      commentId: string,
      parentId: string | null,
      removedReplies: number,
    ) => {
      setComments((prev) => {
        if (!prev) return prev;
        if (parentId) {
          return prev.map((root) => {
            if (root.id !== parentId) return root;
            return {
              ...root,
              replies: (root.replies ?? []).filter((r) => r.id !== commentId),
            };
          });
        }
        return prev.filter((c) => c.id !== commentId);
      });
      onPhotoUpdated({
        ...photo,
        comments_count: Math.max(0, photo.comments_count - 1 - removedReplies),
      });
    },
    [onPhotoUpdated, photo],
  );

  return (
    <section className='albutts-reactions'>
      <div className='albutts-reactions__actions'>
        <button
          type='button'
          className={classNames('albutts-froth', {
            'albutts-froth--active': photo.frothed,
          })}
          onClick={toggleFroth}
          disabled={pending}
          aria-pressed={photo.frothed}
        >
          <Icon
            id='favourite'
            icon={photo.frothed ? HeartFillIcon : HeartIcon}
            className='albutts-froth__icon'
          />
          <span className='albutts-froth__label'>
            {intl.formatMessage(
              photo.frothed ? messages.frothed : messages.froth,
            )}
          </span>
          {photo.froths_count > 0 && (
            <span className='albutts-froth__count'>{photo.froths_count}</span>
          )}
        </button>
      </div>

      <h3 className='albutts-reactions__heading'>
        {intl.formatMessage(messages.heading)}
        {photo.comments_count > 0 && (
          <span className='albutts-reactions__count'>
            {photo.comments_count}
          </span>
        )}
      </h3>

      <CommentComposer
        photoId={photo.id}
        placeholder={intl.formatMessage(messages.placeholder)}
        submitLabel={intl.formatMessage(messages.post)}
        pendingLabel={intl.formatMessage(messages.posting)}
        onPosted={handleCommentPosted}
      />

      {comments === null ? (
        <LoadingIndicator />
      ) : comments.length === 0 ? (
        <p className='albutts-reactions__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='albutts-comments'>
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              photoId={photo.id}
              comment={comment}
              replyingTo={replyTo}
              onReplyToggle={setReplyTo}
              onPosted={handleCommentPosted}
              onDeleted={handleCommentDeleted}
            />
          ))}
        </ul>
      )}
    </section>
  );
};

interface CommentRowProps {
  photoId: string;
  comment: ApiAlbumPhotoCommentJSON;
  replyingTo: string | null;
  onReplyToggle: (id: string | null) => void;
  onPosted: (comment: ApiAlbumPhotoCommentJSON) => void;
  onDeleted: (
    commentId: string,
    parentId: string | null,
    removedReplies: number,
  ) => void;
}

const CommentRow: React.FC<CommentRowProps> = ({
  photoId,
  comment,
  replyingTo,
  onReplyToggle,
  onPosted,
  onDeleted,
}) => {
  const intl = useIntl();
  const account = createAccountFromServerJSON(comment.account);
  const isReplying = replyingTo === comment.id;
  const isRoot = comment.parent_id === null;
  const canDelete = comment.account.id === me;

  const handleDelete = useCallback(() => {
    void apiDeletePhotoComment(photoId, comment.id)
      .then(() => {
        onDeleted(
          comment.id,
          comment.parent_id,
          comment.replies?.length ?? 0,
        );
      })
      .catch(() => undefined);
  }, [comment.id, comment.parent_id, comment.replies, onDeleted, photoId]);

  const handleReplyToggle = useCallback(() => {
    onReplyToggle(isReplying ? null : comment.id);
  }, [comment.id, isReplying, onReplyToggle]);

  const handleReplyCancel = useCallback(() => {
    onReplyToggle(null);
  }, [onReplyToggle]);

  return (
    <li className='albutts-comment'>
      <img
        className='albutts-comment__avatar'
        src={account.avatar}
        alt=''
      />
      <div className='albutts-comment__body'>
        <div className='albutts-comment__meta'>
          <span className='albutts-comment__name'>
            {authorName(comment.account)}
          </span>
          <span className='albutts-comment__handle'>
            @{comment.account.acct}
          </span>
          <RelativeTimestamp timestamp={comment.created_at} />
        </div>
        <p className='albutts-comment__text'>{comment.body}</p>
        <div className='albutts-comment__actions'>
          {isRoot && (
            <button
              type='button'
              className='albutts-comment__action'
              onClick={handleReplyToggle}
            >
              {intl.formatMessage(messages.reply)}
            </button>
          )}
          {canDelete && (
            <button
              type='button'
              className='albutts-comment__action'
              onClick={handleDelete}
            >
              {intl.formatMessage(messages.delete)}
            </button>
          )}
        </div>

        {isReplying && (
          <div className='albutts-comment__reply-composer'>
            <CommentComposer
              photoId={photoId}
              parentId={comment.id}
              placeholder={intl.formatMessage(messages.replyPlaceholder)}
              submitLabel={intl.formatMessage(messages.reply)}
              pendingLabel={intl.formatMessage(messages.posting)}
              onPosted={onPosted}
              onCancel={handleReplyCancel}
            />
          </div>
        )}

        {(comment.replies?.length ?? 0) > 0 && (
          <ul className='albutts-comments albutts-comments--replies'>
            {comment.replies?.map((reply) => (
              <CommentRow
                key={reply.id}
                photoId={photoId}
                comment={reply}
                replyingTo={replyingTo}
                onReplyToggle={onReplyToggle}
                onPosted={onPosted}
                onDeleted={onDeleted}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

interface CommentComposerProps {
  photoId: string;
  parentId?: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
  onPosted: (comment: ApiAlbumPhotoCommentJSON) => void;
  onCancel?: () => void;
}

const CommentComposer: React.FC<CommentComposerProps> = ({
  photoId,
  parentId,
  placeholder,
  submitLabel,
  pendingLabel,
  onPosted,
  onCancel,
}) => {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.currentTarget.value);
    },
    [],
  );

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const body = text.trim();
      if (!body || posting) return;
      setPosting(true);
      apiCreatePhotoComment(
        photoId,
        parentId ? { body, parent_id: parentId } : { body },
      )
        .then((created) => {
          setText('');
          onPosted(created);
        })
        .catch(() => undefined)
        .finally(() => {
          setPosting(false);
        });
    },
    [onPosted, parentId, photoId, posting, text],
  );

  return (
    <form className='albutts-comment-composer' onSubmit={submit}>
      <textarea
        className='albutts-comment-composer__textarea'
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={2000}
        rows={2}
      />
      <div className='albutts-comment-composer__actions'>
        {onCancel && (
          <Button secondary onClick={onCancel}>
            <FormattedCancel />
          </Button>
        )}
        <Button type='submit' disabled={posting || text.trim().length === 0}>
          {posting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
};

const FormattedCancel: React.FC = () => {
  const intl = useIntl();
  return <>{intl.formatMessage(messages.cancel)}</>;
};
