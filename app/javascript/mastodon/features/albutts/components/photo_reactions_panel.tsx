import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import HeartIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import HeartOutlineIcon from '@/material-icons/400-24px/favorite.svg?react';
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
import { Avatar } from 'mastodon/components/avatar';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { me } from 'mastodon/initial_state';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  froth: { id: 'albutts.reactions.froth', defaultMessage: 'Froth' },
  unfroth: { id: 'albutts.reactions.unfroth', defaultMessage: 'Unfroth' },
  froths: {
    id: 'albutts.reactions.froths_count',
    defaultMessage: '{count, plural, one {# froth} other {# froths}}',
  },
  comments: {
    id: 'albutts.reactions.comments_count',
    defaultMessage: '{count, plural, one {# comment} other {# comments}}',
  },
  addComment: {
    id: 'albutts.reactions.add_comment',
    defaultMessage: 'Add a comment',
  },
  reply: { id: 'albutts.reactions.reply', defaultMessage: 'Reply' },
  cancel: { id: 'albutts.reactions.cancel', defaultMessage: 'Cancel' },
  post: { id: 'albutts.reactions.post', defaultMessage: 'Post' },
  posting: { id: 'albutts.reactions.posting', defaultMessage: 'Posting…' },
  delete: { id: 'albutts.reactions.delete', defaultMessage: 'Delete' },
  loadFailed: {
    id: 'albutts.reactions.load_failed',
    defaultMessage: 'Could not load comments.',
  },
});

interface PhotoReactionsPanelProps {
  photo: ApiAlbumPhotoJSON;
  onPhotoUpdated: (photo: ApiAlbumPhotoJSON) => void;
}

export const PhotoReactionsPanel: React.FC<PhotoReactionsPanelProps> = ({
  photo,
  onPhotoUpdated,
}) => {
  const intl = useIntl();
  const [comments, setComments] = useState<ApiAlbumPhotoCommentJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    apiListPhotoComments(photo.id)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.id]);

  const toggleFroth = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const call = photo.frothed
      ? apiUnfrothPhoto(photo.id)
      : apiFrothPhoto(photo.id);
    call
      .then((updated) => {
        onPhotoUpdated(updated);
      })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  }, [busy, photo.frothed, photo.id, onPhotoUpdated]);

  const handleCommentPosted = useCallback(
    (comment: ApiAlbumPhotoCommentJSON) => {
      setComments((prev) => {
        if (comment.parent_id) {
          return prev.map((root) => {
            if (root.id !== comment.parent_id) return root;
            return {
              ...root,
              replies: [...(root.replies ?? []), comment],
            };
          });
        }
        return [...prev, { ...comment, replies: comment.replies ?? [] }];
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
    (commentId: string, parentId: string | null, removedReplies: number) => {
      setComments((prev) => {
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
    <div className='albutts-reactions'>
      <div className='albutts-reactions__froth-row'>
        <button
          type='button'
          className={`albutts-reactions__froth ${
            photo.frothed ? 'is-frothed' : ''
          }`}
          onClick={toggleFroth}
          disabled={busy}
          aria-pressed={photo.frothed}
          title={intl.formatMessage(
            photo.frothed ? messages.unfroth : messages.froth,
          )}
        >
          {photo.frothed ? <HeartIcon /> : <HeartOutlineIcon />}
          <span>
            {intl.formatMessage(messages.froths, {
              count: photo.froths_count,
            })}
          </span>
        </button>
        <span className='albutts-reactions__count'>
          {intl.formatMessage(messages.comments, {
            count: photo.comments_count,
          })}
        </span>
      </div>

      <div className='albutts-reactions__comments'>
        {loading && (
          <p className='albutts-reactions__placeholder'>Loading…</p>
        )}
        {loadError && (
          <p className='albutts-reactions__placeholder'>
            {intl.formatMessage(messages.loadFailed)}
          </p>
        )}
        {!loading && !loadError &&
          comments.map((comment) => (
            <CommentRow
              key={comment.id}
              photoId={photo.id}
              comment={comment}
              replyTo={replyTo}
              onReplyToggle={setReplyTo}
              onCommentPosted={handleCommentPosted}
              onCommentDeleted={handleCommentDeleted}
            />
          ))}

        {!replyTo && (
          <CommentComposer
            photoId={photo.id}
            placeholder={intl.formatMessage(messages.addComment)}
            onPosted={handleCommentPosted}
          />
        )}
      </div>
    </div>
  );
};

interface CommentRowProps {
  photoId: string;
  comment: ApiAlbumPhotoCommentJSON;
  replyTo: string | null;
  onReplyToggle: (id: string | null) => void;
  onCommentPosted: (comment: ApiAlbumPhotoCommentJSON) => void;
  onCommentDeleted: (
    commentId: string,
    parentId: string | null,
    removedReplies: number,
  ) => void;
}

const CommentRow: React.FC<CommentRowProps> = ({
  photoId,
  comment,
  replyTo,
  onReplyToggle,
  onCommentPosted,
  onCommentDeleted,
}) => {
  const intl = useIntl();
  const account = createAccountFromServerJSON(comment.account);
  const isReplying = replyTo === comment.id;
  const canDelete = comment.account.id === me;

  const handleDelete = useCallback(() => {
    void apiDeletePhotoComment(photoId, comment.id)
      .then(() => {
        onCommentDeleted(
          comment.id,
          comment.parent_id,
          comment.replies?.length ?? 0,
        );
      })
      .catch(() => undefined);
  }, [comment.id, comment.parent_id, comment.replies, onCommentDeleted, photoId]);

  return (
    <div className='albutts-comment'>
      <div className='albutts-comment__row'>
        <Avatar account={account} size={28} />
        <div className='albutts-comment__body'>
          <div className='albutts-comment__meta'>
            <span className='albutts-comment__author'>
              {account.display_name || account.username}
            </span>
            <RelativeTimestamp timestamp={comment.created_at} />
          </div>
          <p className='albutts-comment__text'>{comment.body}</p>
          <div className='albutts-comment__actions'>
            {!comment.parent_id && (
              <button
                type='button'
                className='albutts-comment__action'
                onClick={() =>
                  onReplyToggle(isReplying ? null : comment.id)
                }
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
        </div>
      </div>

      {(comment.replies?.length ?? 0) > 0 && (
        <div className='albutts-comment__replies'>
          {comment.replies?.map((reply) => (
            <CommentRow
              key={reply.id}
              photoId={photoId}
              comment={reply}
              replyTo={replyTo}
              onReplyToggle={onReplyToggle}
              onCommentPosted={onCommentPosted}
              onCommentDeleted={onCommentDeleted}
            />
          ))}
        </div>
      )}

      {isReplying && (
        <div className='albutts-comment__reply-composer'>
          <CommentComposer
            photoId={photoId}
            parentId={comment.id}
            placeholder={intl.formatMessage(messages.reply)}
            onPosted={onCommentPosted}
            onCancel={() => onReplyToggle(null)}
          />
        </div>
      )}
    </div>
  );
};

interface CommentComposerProps {
  photoId: string;
  parentId?: string;
  placeholder: string;
  onPosted: (comment: ApiAlbumPhotoCommentJSON) => void;
  onCancel?: () => void;
}

const CommentComposer: React.FC<CommentComposerProps> = ({
  photoId,
  parentId,
  placeholder,
  onPosted,
  onCancel,
}) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = useCallback(() => {
    const body = text.trim();
    if (body.length === 0 || posting) return;
    setPosting(true);
    apiCreatePhotoComment(photoId, parentId ? { body, parent_id: parentId } : { body })
      .then((created) => {
        setText('');
        onPosted(created);
      })
      .catch(() => undefined)
      .finally(() => {
        setPosting(false);
      });
  }, [onPosted, parentId, photoId, posting, text]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <form className='albutts-comment-composer' onSubmit={handleSubmit}>
      <textarea
        className='albutts-comment-composer__textarea'
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        rows={2}
        maxLength={2000}
      />
      <div className='albutts-comment-composer__actions'>
        {onCancel && (
          <button
            type='button'
            className='albutts-btn'
            onClick={onCancel}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
        )}
        <button
          type='submit'
          className='albutts-btn albutts-btn--primary'
          disabled={posting || text.trim().length === 0}
        >
          {posting
            ? intl.formatMessage(messages.posting)
            : intl.formatMessage(messages.post)}
        </button>
      </div>
    </form>
  );
};
