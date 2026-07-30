import { useCallback, useEffect, useState } from 'react';

import {
  defineMessages,
  useIntl,
  FormattedMessage,
  FormattedDate,
} from 'react-intl';

import { Link } from 'react-router-dom';

import api from 'mastodon/api';

// Comments on a proposal — the discussion surface (support-model proposal page).
// One level of threading: root comments carry their `replies`. This is the real
// comments store; the old vote-response "discussion" is retired.

interface CommentAccount {
  acct: string;
  username: string;
  display_name: string;
  avatar: string;
}

interface CommentJSON {
  id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  account: CommentAccount;
  replies?: CommentJSON[];
}

const messages = defineMessages({
  heading: { id: 'comments.heading', defaultMessage: 'Comments' },
  placeholder: { id: 'comments.placeholder', defaultMessage: 'Add a comment…' },
  replyPlaceholder: {
    id: 'comments.reply_placeholder',
    defaultMessage: 'Reply…',
  },
  post: { id: 'comments.post', defaultMessage: 'Comment' },
  reply: { id: 'comments.reply', defaultMessage: 'Reply' },
  empty: {
    id: 'comments.empty',
    defaultMessage: 'No comments yet. Start the discussion.',
  },
});

const CommentRow: React.FC<{
  comment: CommentJSON;
  isReply?: boolean;
  onReplyClick?: (id: string) => void;
}> = ({ comment, isReply = false, onReplyClick }) => {
  const { account } = comment;
  const acctPath = `/@${account.acct}`;

  const handleReply = useCallback(() => {
    onReplyClick?.(comment.id);
  }, [onReplyClick, comment.id]);

  return (
    <div
      className={`proposal-comment ${isReply ? 'proposal-comment--reply' : ''}`}
    >
      <Link to={acctPath} className='proposal-comment__avatar'>
        <img src={account.avatar} alt='' width={34} height={34} />
      </Link>
      <div className='proposal-comment__body'>
        <div className='proposal-comment__head'>
          <Link to={acctPath} className='proposal-comment__name'>
            {account.display_name || account.username}
          </Link>
          <span className='proposal-comment__at'>@{account.acct}</span>
          <span className='proposal-comment__time'>
            <FormattedDate
              value={comment.created_at}
              day='numeric'
              month='short'
            />
          </span>
        </div>
        <div className='proposal-comment__text'>{comment.body}</div>
        {!isReply && onReplyClick && (
          <button
            type='button'
            className='proposal-comment__reply-btn'
            onClick={handleReply}
          >
            <FormattedMessage id='comments.reply' defaultMessage='Reply' />
          </button>
        )}
      </div>
    </div>
  );
};

export const ProposalComments: React.FC<{ proposalId: string }> = ({
  proposalId,
}) => {
  const intl = useIntl();
  const [comments, setComments] = useState<CommentJSON[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    api()
      .get<CommentJSON[]>(`/api/v1/proposals/${proposalId}/comments`)
      .then((res) => {
        setComments(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(
    (body: string, parentId: string | null) => {
      const text = body.trim();
      if (!text || posting) return;
      setPosting(true);
      api()
        .post(`/api/v1/proposals/${proposalId}/comments`, {
          comment: { body: text, parent_id: parentId },
        })
        .then(() => {
          setDraft('');
          setReplyDraft('');
          setReplyTo(null);
          load();
          return undefined;
        })
        .catch(() => undefined)
        .finally(() => {
          setPosting(false);
        });
    },
    [proposalId, posting, load],
  );

  const handleDraft = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
    },
    [],
  );
  const handleReplyDraft = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReplyDraft(e.target.value);
    },
    [],
  );
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      post(draft, null);
    },
    [post, draft],
  );
  const handleReplyClick = useCallback((id: string) => {
    setReplyTo((cur) => (cur === id ? null : id));
    setReplyDraft('');
  }, []);
  const handleReplySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (replyTo) post(replyDraft, replyTo);
    },
    [post, replyDraft, replyTo],
  );

  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  return (
    <section className='proposal-comments'>
      <h2 className='proposal-comments__heading'>
        {intl.formatMessage(messages.heading)}
        {total > 0 && <span className='proposal-comments__count'>{total}</span>}
      </h2>

      <div className='proposal-comments__list'>
        {comments.length === 0 && (
          <p className='proposal-comments__empty'>
            {intl.formatMessage(messages.empty)}
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className='proposal-comments__thread'>
            <CommentRow comment={c} onReplyClick={handleReplyClick} />
            {c.replies?.map((r) => (
              <CommentRow key={r.id} comment={r} isReply />
            ))}
            {replyTo === c.id && (
              <form
                className='proposal-comments__reply-form'
                onSubmit={handleReplySubmit}
              >
                <textarea
                  className='proposal-comments__textarea'
                  value={replyDraft}
                  onChange={handleReplyDraft}
                  placeholder={intl.formatMessage(messages.replyPlaceholder)}
                  rows={2}
                />
                <button
                  type='submit'
                  className='proposal-comments__post'
                  disabled={posting || replyDraft.trim().length === 0}
                >
                  {intl.formatMessage(messages.reply)}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <form className='proposal-comments__add' onSubmit={handleSubmit}>
        <textarea
          className='proposal-comments__textarea'
          value={draft}
          onChange={handleDraft}
          placeholder={intl.formatMessage(messages.placeholder)}
          rows={3}
        />
        <div className='proposal-comments__add-actions'>
          <button
            type='submit'
            className='proposal-comments__post'
            disabled={posting || draft.trim().length === 0}
          >
            {intl.formatMessage(messages.post)}
          </button>
        </div>
      </form>
    </section>
  );
};
