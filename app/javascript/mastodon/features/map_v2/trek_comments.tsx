import { useState, useEffect, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiRequestPost } from 'mastodon/api';
import { apiGetContext } from 'mastodon/api/statuses';
import type { ApiStatusJSON } from 'mastodon/api_types/statuses';
import { Button } from 'mastodon/components/button';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';

// Map — comments on a published trek. A trek's timeline Status carries the
// conversation: comments are its replies (froth is a Favourite). We render a
// flat list of the Status's descendants and post new comments as replies via
// the standard status API. Reply visibility follows the poster's default; a
// follow-up (docs/kronk_feed_and_reach.md) is to mirror the trek's reach.

const messages = defineMessages({
  heading: { id: 'map.treks.comments', defaultMessage: 'Comments' },
  placeholder: {
    id: 'map.treks.comment_placeholder',
    defaultMessage: 'Add a comment…',
  },
  post: { id: 'map.treks.comment_post', defaultMessage: 'Comment' },
  posting: { id: 'map.treks.comment_posting', defaultMessage: 'Posting…' },
  empty: {
    id: 'map.treks.comments_empty',
    defaultMessage: 'No comments yet. Be the first.',
  },
});

const authorName = (account: ApiStatusJSON['account']): string =>
  account.display_name.length > 0 ? account.display_name : account.username;

export const TrekComments: React.FC<{ statusId: string }> = ({ statusId }) => {
  const intl = useIntl();
  const [comments, setComments] = useState<ApiStatusJSON[] | null>(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(() => {
    void apiGetContext(statusId)
      .then(({ context }) => {
        setComments(context.descendants);
      })
      .catch(() => {
        setComments([]);
      });
  }, [statusId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onText = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.currentTarget.value);
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const body = text.trim();
      if (!body) return;

      setPosting(true);
      void apiRequestPost<ApiStatusJSON>('v1/statuses', {
        status: body,
        in_reply_to_id: statusId,
      })
        .then(() => {
          setText('');
          refresh();
        })
        .finally(() => {
          setPosting(false);
        });
    },
    [text, statusId, refresh],
  );

  return (
    <section className='trek-comments'>
      <h3 className='trek-comments__heading'>
        {intl.formatMessage(messages.heading)}
      </h3>

      <form className='trek-comments__compose' onSubmit={submit}>
        <textarea
          value={text}
          onChange={onText}
          placeholder={intl.formatMessage(messages.placeholder)}
          maxLength={500}
          rows={2}
        />
        <Button type='submit' disabled={posting || text.trim().length === 0}>
          {intl.formatMessage(posting ? messages.posting : messages.post)}
        </Button>
      </form>

      {comments === null ? (
        <LoadingIndicator />
      ) : comments.length === 0 ? (
        <p className='trek-comments__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      ) : (
        <ul className='trek-comments__list'>
          {comments.map((comment) => (
            <li key={comment.id} className='trek-comment'>
              <img
                className='trek-comment__avatar'
                src={comment.account.avatar}
                alt=''
              />
              <div className='trek-comment__body'>
                <div className='trek-comment__meta'>
                  <span className='trek-comment__name'>
                    {authorName(comment.account)}
                  </span>
                  <span className='trek-comment__handle'>
                    @{comment.account.acct}
                  </span>
                  <RelativeTimestamp timestamp={comment.created_at} />
                </div>
                <div
                  className='trek-comment__content'
                  // Status content is sanitised server-side (as everywhere the
                  // app renders a status body).
                  dangerouslySetInnerHTML={{ __html: comment.content ?? '' }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
