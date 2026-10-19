import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import FormatQuoteIcon from '@/material-icons/400-24px/format_quote.svg?react';
import {
  apiFtdComment,
  apiFtdMentionable,
  apiFtdRemoveComment,
  apiFtdResolveThread,
} from 'mastodon/api/freethedream';
import type {
  FtdAccount,
  FtdComment,
  FtdQuotedItem,
} from 'mastodon/api_types/freethedream';
import { Icon } from 'mastodon/components/icon';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

import { act } from './act';
import { Person, Section, errorOf, formatAmount, formatNeed } from './shared';

// Talk: threads, each with replies under it. Anyone in the project can
// resolve a thread once it's settled, and resolved threads fold away, so
// someone arriving late sees only what's still live (Tal, 2026-10-13: a
// pile of 300 messages is a barrier, not a conversation).
//
// A thread can quote a thing on the list ("Talk about it" on a Thing
// Bringing row), shown as a card on it, so a need can be discussed where
// everyone sees it. Anyone in the emergence can be tagged with @username:
// typing @ suggests people, and whoever's tagged gets a Nudge (Tal,
// 2026-10-18).

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
  aboutThis: {
    id: 'freethedream.talk.about_this',
    defaultMessage: 'Say something about it',
  },
  unquote: {
    id: 'freethedream.talk.unquote',
    defaultMessage: 'Not about {title}',
  },
  quoteComing: {
    id: 'freethedream.talk.quote_coming',
    defaultMessage: '{coming} coming of {wanted}',
  },
  quoteSorted: { id: 'freethedream.bring.sorted', defaultMessage: 'Sorted' },
  quoteNeeded: {
    id: 'freethedream.talk.quote_needed',
    defaultMessage: 'Still needed',
  },
  quoteActualise: {
    id: 'freethedream.kind.actualise',
    defaultMessage: 'To actualise',
  },
  tagSomeone: {
    id: 'freethedream.talk.tag',
    defaultMessage: 'People to tag',
  },
});

const MENTION_SPLIT = /(@[a-z0-9_]+)/gi;
// What's being typed right before the cursor: "@ca" while tagging.
const TYPING_MENTION = /(?:^|\s)@([a-z0-9_]*)$/i;

interface Props {
  subjectType: 'project' | 'item';
  subjectId: string;
  // A part of the emergence, for who can be tagged.
  emergenceId: string;
  comments: FtdComment[];
  canComment: boolean;
  // A thing to start a thread about, from "Talk about it".
  quote?: FtdQuotedItem | null;
  onQuoteDone?: () => void;
}

export const Talk: React.FC<Props> = ({
  subjectType,
  subjectId,
  emergenceId,
  comments: initial,
  canComment,
  quote,
  onQuoteDone,
}) => {
  const intl = useIntl();
  const [threads, setThreads] = useState(initial);
  const [showResolved, setShowResolved] = useState(false);
  const here = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreads(initial);
  }, [initial]);

  // Arriving to talk about a thing: Talk comes into view.
  useEffect(() => {
    if (quote) here.current?.scrollIntoView({ block: 'center' });
  }, [quote]);

  const post = useCallback(
    (body: string, parentId?: string) =>
      apiFtdComment(subjectType, subjectId, body, parentId).then(setThreads),
    [subjectType, subjectId],
  );
  const postThread = useCallback(
    (body: string) =>
      apiFtdComment(subjectType, subjectId, body, undefined, quote?.id).then(
        (next) => {
          setThreads(next);
          onQuoteDone?.();
        },
      ),
    [subjectType, subjectId, quote, onQuoteDone],
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
              emergenceId={emergenceId}
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
              emergenceId={emergenceId}
              onPost={post}
              onChange={setThreads}
            />
          ))}
        </ul>
      )}

      {canComment && (
        <div ref={here}>
          <Composer
            placeholder={intl.formatMessage(
              quote ? messages.aboutThis : messages.newThread,
            )}
            onPost={postThread}
            emergenceId={emergenceId}
            quote={quote}
            onUnquote={onQuoteDone}
            focusOnOpen={!!quote}
          />
        </div>
      )}
    </Section>
  );
};

interface ThreadProps {
  comment: FtdComment;
  depth: number;
  canComment: boolean;
  emergenceId: string;
  onPost: (body: string, parentId?: string) => Promise<unknown>;
  onChange: (threads: FtdComment[]) => void;
}

const Thread: React.FC<ThreadProps> = ({
  comment,
  depth,
  canComment,
  emergenceId,
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
    void act(apiFtdResolveThread(comment.id, !comment.resolved).then(onChange));
  }, [comment.id, comment.resolved, onChange]);
  const handleRemove = useCallback(() => {
    void act(apiFtdRemoveComment(comment.id).then(onChange));
  }, [comment.id, onChange]);

  return (
    <li
      className={`freethedream-talk__item${depth === 0 ? ' freethedream-talk__item--thread' : ''}`}
    >
      <div className='freethedream-talk__meta'>
        <Person account={comment.account} />
        <RelativeTimestamp timestamp={comment.created_at} />
      </div>
      {comment.quoted_item && !comment.removed && (
        <QuotedCard item={comment.quoted_item} />
      )}
      <p
        className={`freethedream-talk__body${comment.removed ? ' freethedream-talk__body--removed' : ''}`}
      >
        {comment.removed ? (
          intl.formatMessage(messages.removed)
        ) : (
          <Body comment={comment} />
        )}
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
              emergenceId={emergenceId}
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
                emergenceId={emergenceId}
                focusOnOpen
              />
            </li>
          )}
        </ul>
      )}
    </li>
  );
};

// A comment's words, with each @username of someone tagged as a link to
// them.
const Body: React.FC<{ comment: FtdComment }> = ({ comment }) => {
  const tagged = new Map(
    comment.mentions.map((m) => [m.username.toLowerCase(), m]),
  );
  return (
    <>
      {comment.body.split(MENTION_SPLIT).map((part, i) => {
        const who = part.startsWith('@')
          ? tagged.get(part.slice(1).toLowerCase())
          : undefined;
        return who ? (
          // The body is fixed once posted, so a part's place is its key.
          <Link key={i} to={`/@${who.acct}`} className='freethedream-talk__tag'>
            {part}
          </Link>
        ) : (
          part
        );
      })}
    </>
  );
};

// A thing on the list, as a card on a comment about it: what, and how it's
// going.
const QuotedCard: React.FC<{
  item: FtdQuotedItem;
  onRemove?: () => void;
}> = ({ item, onRemove }) => {
  const intl = useIntl();
  const covered = item.covered ?? 0;
  const counted = item.quantity > 1 || item.unit !== '';
  const state =
    item.kind !== 'need'
      ? intl.formatMessage(messages.quoteActualise)
      : counted && covered < item.quantity
        ? intl.formatMessage(messages.quoteComing, {
            coming: formatAmount(covered, item.unit),
            wanted: formatNeed(item.quantity, item.unit, item.more_welcome),
          })
        : covered >= item.quantity
          ? intl.formatMessage(messages.quoteSorted)
          : intl.formatMessage(messages.quoteNeeded);
  return (
    <div className='freethedream-quote'>
      <Icon id='format_quote' icon={FormatQuoteIcon} />
      <Link
        to={`/hub/freethedream/i/${item.id}`}
        className='freethedream-quote__main'
      >
        <span className='freethedream-quote__title'>
          {item.title}
          {counted && item.kind === 'need' && (
            <span className='freethedream-quote__amount'>
              {formatNeed(item.quantity, item.unit, item.more_welcome)}
            </span>
          )}
        </span>
        <span className='freethedream-quote__state'>{state}</span>
      </Link>
      {onRemove && (
        <button
          type='button'
          className='freethedream-quote__remove'
          onClick={onRemove}
          aria-label={intl.formatMessage(messages.unquote, {
            title: item.title,
          })}
        >
          ×
        </button>
      )}
    </div>
  );
};

interface ComposerProps {
  placeholder: string;
  onPost: (body: string) => Promise<unknown>;
  onCancel?: () => void;
  focusOnOpen?: boolean;
  emergenceId: string;
  quote?: FtdQuotedItem | null;
  onUnquote?: () => void;
}

const Composer: React.FC<ComposerProps> = ({
  placeholder,
  onPost,
  onCancel,
  focusOnOpen,
  emergenceId,
  quote,
  onUnquote,
}) => {
  const intl = useIntl();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // Tagging: what's typed after the @, where the @ is, who matches.
  const [tagging, setTagging] = useState<{ q: string; at: number } | null>(
    null,
  );
  const [people, setPeople] = useState<FtdAccount[]>([]);
  const [active, setActive] = useState(0);

  // A reply box opens where you tapped Reply, ready to type; so does the
  // box for talking about a thing.
  useEffect(() => {
    if (focusOnOpen) field.current?.focus();
  }, [focusOnOpen, quote]);

  const query = tagging?.q;
  useEffect(() => {
    if (query === undefined) {
      setPeople([]);
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      apiFtdMentionable(emergenceId, query)
        .then((found) => {
          if (!live) return;
          setPeople(found);
          setActive(0);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, emergenceId]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setDraft(text);
      const caret = e.target.selectionStart;
      const typed = TYPING_MENTION.exec(text.slice(0, caret));
      setTagging(
        typed
          ? { q: typed[1] ?? '', at: caret - (typed[1] ?? '').length }
          : null,
      );
    },
    [],
  );

  const choose = useCallback(
    (account: FtdAccount) => {
      if (!tagging) return;
      const caret = field.current?.selectionStart ?? draft.length;
      const before = draft.slice(0, tagging.at);
      const after = draft.slice(caret);
      const next = `${before}${account.acct} ${after}`;
      setDraft(next);
      setTagging(null);
      const at = before.length + account.acct.length + 1;
      window.requestAnimationFrame(() => {
        field.current?.focus();
        field.current?.setSelectionRange(at, at);
      });
    },
    [tagging, draft],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!tagging || people.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + step + people.length) % people.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const who = people[active];
        if (!who) return;
        e.preventDefault();
        choose(who);
      } else if (e.key === 'Escape') {
        setTagging(null);
      }
    },
    [tagging, people, active, choose],
  );

  const handlePick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const who = people.find((p) => p.id === e.currentTarget.dataset.id);
      if (who) choose(who);
    },
    [people, choose],
  );
  // Picking from the list mustn't take the cursor out of the box first.
  const keepFocus = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body || busy) return;
      setBusy(true);
      setError(null);
      setTagging(null);
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

  const suggesting = tagging !== null && people.length > 0;

  return (
    <form className='freethedream-talk__form' onSubmit={handleSubmit}>
      {quote && <QuotedCard item={quote} onRemove={onUnquote} />}
      <div className='freethedream-talk__field'>
        <textarea
          className='freethedream__input'
          rows={2}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete='list'
          maxLength={2000}
          ref={field}
        />
        {suggesting && (
          <ul
            className='freethedream-mentions'
            role='listbox'
            aria-label={intl.formatMessage(messages.tagSomeone)}
          >
            {people.map((p, i) => (
              <li key={p.id} role='option' aria-selected={i === active}>
                <button
                  type='button'
                  className={
                    i === active
                      ? 'freethedream-mentions__person freethedream-mentions__person--active'
                      : 'freethedream-mentions__person'
                  }
                  data-id={p.id}
                  onMouseDown={keepFocus}
                  onClick={handlePick}
                >
                  <img
                    className='freethedream-mentions__avatar'
                    src={p.avatar}
                    alt=''
                  />
                  <span className='freethedream-mentions__name'>
                    {p.display_name}
                  </span>
                  <span className='freethedream-mentions__acct'>@{p.acct}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
