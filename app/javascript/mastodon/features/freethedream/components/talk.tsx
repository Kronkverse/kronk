import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiFtdComment,
  apiFtdRemoveComment,
  apiFtdResolveThread,
} from 'mastodon/api/freethedream';
import type { FtdComment } from 'mastodon/api_types/freethedream';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { Person, Section, errorOf } from './shared';

// Talk: threads, each with replies under it. Anyone in the project can
// resolve a thread once it's settled, and resolved threads fold away, so
// someone arriving late sees only what's still live (Tal, 2026-10-13: a
// pile of 300 messages is a barrier, not a conversation).

const messages = defineMessages({
  title: { id: 'freethedream.talk.title', defaultMessage: 'Talk' },
  newThread: {
    id: 'freethedream.talk.new',
    defaultMessage: 'Start a thread',
  },
  reply: { id: 'freethedream.talk.reply', defaultMessage: 'Reply' },
  replyPlaceholder: {
    id: 'freethedream.talk.reply_placeholder',
    defaultMessage: 'Write a reply',
  },
  post: { id: 'freethedream.talk.post', defaultMessage: 'Post' },
  cancel: { id: 'freethedream.talk.cancel', defaultMessage: 'Cancel' },
  remove: { id: 'freethedream.talk.remove', defaultMessage: 'Remove' },
  resolve: { id: 'freethedream.talk.resolve', defaultMessage: 'Resolve' },
  reopen: { id: 'freethedream.talk.reopen', defaultMessage: 'Reopen' },
  removed: { id: 'freethedream.talk.removed', defaultMessage: 'Removed' },
});

interface Props {
  subjectType: 'project' | 'item';
  subjectId: string;
  comments: FtdComment[];
  canComment: boolean;
}

export const Talk: React.FC<Props> = ({
  subjectType,
  subjectId,
  comments: initial,
  canComment,
}) => {
  const intl = useIntl();
  const [threads, setThreads] = useState(initial);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    setThreads(initial);
  }, [initial]);

  const post = useCallback(
    (body: string, parentId?: string) =>
      apiFtdComment(subjectType, subjectId, body, parentId).then(setThreads),
    [subjectType, subjectId],
  );

  const toggleResolved = useCallback(() => {
    setShowResolved((s) => !s);
  }, []);

  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);

  if (threads.length === 0 && !canComment) return null;

  return (
    <Section title={intl.formatMessage(messages.title)}>
      {open.length > 0 && (
        <ul className='freethedream-talk'>
          {open.map((t) => (
            <Thread
              key={t.id}
              comment={t}
              depth={0}
              canComment={canComment}
              onPost={post}
              onChange={setThreads}
            />
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <button
          type='button'
          className='freethedream__link freethedream-talk__fold'
          onClick={toggleResolved}
        >
          <FormattedMessage
            id='freethedream.talk.resolved'
            defaultMessage='{count, plural, one {# resolved thread} other {# resolved threads}}'
            values={{ count: resolved.length }}
          />
        </button>
      )}
      {showResolved && (
        <ul className='freethedream-talk freethedream-talk--resolved'>
          {resolved.map((t) => (
            <Thread
              key={t.id}
              comment={t}
              depth={0}
              canComment={canComment}
              onPost={post}
              onChange={setThreads}
            />
          ))}
        </ul>
      )}

      {canComment && (
        <Composer
          placeholder={intl.formatMessage(messages.newThread)}
          onPost={post}
        />
      )}
    </Section>
  );
};

interface ThreadProps {
  comment: FtdComment;
  depth: number;
  canComment: boolean;
  onPost: (body: string, parentId?: string) => Promise<unknown>;
  onChange: (threads: FtdComment[]) => void;
}

const Thread: React.FC<ThreadProps> = ({
  comment,
  depth,
  canComment,
  onPost,
  onChange,
}) => {
  const intl = useIntl();
  const [replying, setReplying] = useState(false);

  const openReply = useCallback(() => {
    setReplying(true);
  }, []);
  const closeReply = useCallback(() => {
    setReplying(false);
  }, []);
  const handleReply = useCallback(
    (body: string) =>
      onPost(body, comment.id).then(() => {
        setReplying(false);
      }),
    [onPost, comment.id],
  );
  const handleResolve = useCallback(() => {
    void apiFtdResolveThread(comment.id, !comment.resolved).then(onChange);
  }, [comment.id, comment.resolved, onChange]);
  const handleRemove = useCallback(() => {
    void apiFtdRemoveComment(comment.id).then(onChange);
  }, [comment.id, onChange]);

  return (
    <li
      className={`freethedream-talk__item${depth === 0 ? ' freethedream-talk__item--thread' : ''}`}
    >
      <div className='freethedream-talk__meta'>
        <Person account={comment.account} />
        <RelativeTimestamp timestamp={comment.created_at} />
      </div>
      <p
        className={`freethedream-talk__body${comment.removed ? ' freethedream-talk__body--removed' : ''}`}
      >
        {comment.removed ? intl.formatMessage(messages.removed) : comment.body}
      </p>
      <div className='freethedream-talk__actions'>
        {canComment && !comment.resolved && (
          <button
            type='button'
            className='freethedream__link'
            onClick={openReply}
          >
            {intl.formatMessage(messages.reply)}
          </button>
        )}
        {canComment && depth === 0 && (
          <button
            type='button'
            className='freethedream__link'
            onClick={handleResolve}
          >
            {intl.formatMessage(
              comment.resolved ? messages.reopen : messages.resolve,
            )}
          </button>
        )}
        {comment.mine && !comment.removed && (
          <button
            type='button'
            className='freethedream__link freethedream__link--danger'
            onClick={handleRemove}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        )}
        {comment.resolved && comment.resolved_by && (
          <span className='freethedream__quiet'>
            <FormattedMessage
              id='freethedream.talk.resolved_by'
              defaultMessage='Resolved by {name}'
              values={{ name: comment.resolved_by.display_name }}
            />
          </span>
        )}
      </div>

      {(comment.replies.length > 0 || replying) && (
        <ul
          className={`freethedream-talk${depth < 2 ? ' freethedream-talk--nested' : ''}`}
        >
          {comment.replies.map((reply) => (
            <Thread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              canComment={canComment}
              onPost={onPost}
              onChange={onChange}
            />
          ))}
          {replying && (
            <li>
              <Composer
                placeholder={intl.formatMessage(messages.replyPlaceholder)}
                onPost={handleReply}
                onCancel={closeReply}
                focusOnOpen
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
};

interface ComposerProps {
  placeholder: string;
  onPost: (body: string) => Promise<unknown>;
  onCancel?: () => void;
  focusOnOpen?: boolean;
}

const Composer: React.FC<ComposerProps> = ({
  placeholder,
  onPost,
  onCancel,
  focusOnOpen,
}) => {
  const intl = useIntl();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // A reply box opens where you tapped Reply, ready to type.
  useEffect(() => {
    if (focusOnOpen) field.current?.focus();
  }, [focusOnOpen]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body || busy) return;
      setBusy(true);
      setError(null);
      onPost(body)
        .then(() => {
          setDraft('');
          setBusy(false);
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setBusy(false);
        });
    },
    [draft, busy, onPost],
  );

  return (
    <form className='freethedream-talk__form' onSubmit={handleSubmit}>
      <textarea
        className='freethedream__input'
        rows={2}
        value={draft}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={2000}
        ref={field}
      />
      <div className='freethedream-talk__form-actions'>
        {onCancel && (
          <button
            type='button'
            className='freethedream__link'
            onClick={onCancel}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
        )}
        <button
          type='submit'
          className='freethedream__button freethedream__button--small'
          disabled={busy || !draft.trim()}
        >
          {intl.formatMessage(messages.post)}
        </button>
      </div>
      {error && (
        <p className='freethedream__error' role='alert'>
          {error}
        </p>
      )}
    </form>
  );
};
