import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import api from 'mastodon/api';
import { apiGetKuestionsDailyPrompt } from 'mastodon/api/kuestions';
import type { ApiKuestionDailyPromptJSON } from 'mastodon/api_types/kuestions';

const messages = defineMessages({
  tagPrompt: {
    id: 'kuestions.today.tag_prompt',
    defaultMessage: "Today's prompt",
  },
  placeholder: {
    id: 'kuestions.today.placeholder',
    defaultMessage: 'Say your piece — it posts to Murmur, like any other post.',
  },
  post: { id: 'kuestions.today.post', defaultMessage: 'Post response' },
  note: {
    id: 'kuestions.today.note',
    defaultMessage:
      "Prompt replies aren't locked — they're just posts. It resets at midnight.",
  },
  postedTitle: {
    id: 'kuestions.today.posted_title',
    defaultMessage: 'Posted to Murmur.',
  },
  postedBody: {
    id: 'kuestions.today.posted_body',
    defaultMessage: 'You answered today.',
  },
  loading: {
    id: 'kuestions.today.loading',
    defaultMessage: 'Loading today’s prompt…',
  },
  none: {
    id: 'kuestions.today.none',
    defaultMessage: 'No prompt today — check back tomorrow.',
  },
  error: {
    id: 'kuestions.today.error',
    defaultMessage: "Couldn't post. Try again.",
  },
});

// Today panel: pulls the Kronk-curated daily prompt and lets the
// viewer post a plain Status to Murmur as a response. Per brief
// §Prompt source: no Kuestion object created, no aggregation — it's
// inspiration, not a container.
export const TodayPanel: React.FC = () => {
  const intl = useIntl();
  const [prompt, setPrompt] = useState<ApiKuestionDailyPromptJSON | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGetKuestionsDailyPrompt();
        setPrompt(data);
      } catch {
        setPrompt({ date: '', prompt: null });
      }
    })();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );

  const handlePost = useCallback(() => {
    const body = text.trim();
    if (!body || pending) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        // Post as a plain Status. Federate defaults per user's
        // account setting; no post-type override — the brief calls
        // out that this is not a Kuestion object.
        await api().post('/api/v1/statuses', { status: body });
        setPosted(true);
        setText('');
      } catch {
        setError('post_failed');
      } finally {
        setPending(false);
      }
    })();
  }, [text, pending]);

  if (!prompt) {
    return (
      <section className='kuestions-panel'>
        <h1 className='space-title'>Today</h1>
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  if (!prompt.prompt) {
    return (
      <section className='kuestions-panel'>
        <h1 className='space-title'>Today</h1>
        <p className='space-subtitle'>{intl.formatMessage(messages.none)}</p>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <h1 className='space-title'>Today</h1>
      <p className='space-subtitle'>
        <FormattedMessage
          id='kuestions.today.subtitle'
          defaultMessage='One prompt from Kronk. Same for everyone.'
        />
      </p>

      <div className='kuestions-today__card'>
        <div className='kuestions-today__tag'>
          <b>Ƙ</b> {intl.formatMessage(messages.tagPrompt)}
        </div>
        <div className='kuestions-today__q'>{prompt.prompt}</div>
        {!posted && (
          <>
            <textarea
              className='kuestions-today__text'
              placeholder={intl.formatMessage(messages.placeholder)}
              value={text}
              onChange={handleChange}
              disabled={pending}
            />
            <div className='kuestions-today__foot'>
              <button
                type='button'
                className='kuestions-btn'
                onClick={handlePost}
                disabled={pending || text.trim() === ''}
              >
                {intl.formatMessage(messages.post)}
              </button>
            </div>
          </>
        )}
        {posted && (
          <div className='kuestions-today__posted'>
            <span>✓</span>
            <div>
              {intl.formatMessage(messages.postedTitle)}{' '}
              <b>{intl.formatMessage(messages.postedBody)}</b>
            </div>
          </div>
        )}
        {error && (
          <p className='kuestions-sheet__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}
        <p className='kuestions-today__note'>
          {intl.formatMessage(messages.note)}
        </p>
      </div>
    </section>
  );
};
