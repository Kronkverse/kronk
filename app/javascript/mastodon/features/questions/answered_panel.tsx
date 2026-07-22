import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiGetKuestion,
  apiListAnsweredKuestions,
} from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { RevealSheet } from './reveal_sheet';

const messages = defineMessages({
  loading: { id: 'kuestions.loading', defaultMessage: 'Loading…' },
  formatText: { id: 'kuestions.format.text', defaultMessage: 'Free text' },
  formatMc: { id: 'kuestions.format.mc', defaultMessage: 'Multiple choice' },
  formatYn: { id: 'kuestions.format.yn', defaultMessage: 'Yes / No' },
  answersLabel: {
    id: 'kuestions.answered.answers_label',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  unlocked: {
    id: 'kuestions.answered.row_unlocked',
    defaultMessage: 'Unlocked ✓',
  },
});

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

interface AnsweredPanelProps {
  onGoDeck: () => void;
}

// Answered = the viewer's unlocked kuestions. Tap a row → re-open the
// reveal sheet on that Kuestion (fetches fresh detail so the answer
// list stays current).
export const AnsweredPanel: React.FC<AnsweredPanelProps> = ({ onGoDeck }) => {
  const intl = useIntl();
  const [list, setList] = useState<ApiKuestionJSON[] | null>(null);
  const [revealing, setRevealing] = useState<ApiKuestionJSON | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiListAnsweredKuestions();
        setList(data);
      } catch {
        setList([]);
      }
    })();
  }, []);

  const handleOpen = useCallback((id: string) => {
    void (async () => {
      try {
        const detail = await apiGetKuestion(id);
        setRevealing(detail);
      } catch {
        // silent — surface an error UI in a follow-up if needed
      }
    })();
  }, []);

  const handleGoDeck = useCallback(() => {
    onGoDeck();
  }, [onGoDeck]);

  const handleCloseReveal = useCallback(() => {
    setRevealing(null);
  }, []);

  if (list === null) {
    return (
      <section className='kuestions-panel'>
        <h1 className='space-title'>Answered</h1>
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  if (list.length === 0) {
    return (
      <section className='kuestions-panel'>
        <h1 className='space-title'>Answered</h1>
        <p className='space-subtitle'>
          <FormattedMessage
            id='kuestions.answered.subtitle'
            defaultMessage='Unlocked by you. These stay open.'
          />
        </p>
        <div className='kuestions-empty'>
          <h3>
            <FormattedMessage
              id='kuestions.answered.empty_title'
              defaultMessage='Nothing unlocked yet'
            />
          </h3>
          <p>
            <FormattedMessage
              id='kuestions.answered.empty_body'
              defaultMessage='Answer a kuestion and it lands here, open for good.'
            />
          </p>
          <button
            type='button'
            className='kuestions-btn'
            onClick={handleGoDeck}
          >
            <FormattedMessage
              id='kuestions.answered.open_deck'
              defaultMessage='Open the deck'
            />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <h1 className='space-title'>Answered</h1>
      <p className='space-subtitle'>
        <FormattedMessage
          id='kuestions.answered.subtitle'
          defaultMessage='Unlocked by you. These stay open.'
        />
      </p>

      <ul className='kuestions-answered'>
        {list.map((k) => (
          <AnsweredRow key={k.id} kuestion={k} onOpen={handleOpen} />
        ))}
      </ul>

      {revealing && (
        <RevealSheet kuestion={revealing} onNext={handleCloseReveal} />
      )}
    </section>
  );
};

interface AnsweredRowProps {
  kuestion: ApiKuestionJSON;
  onOpen: (id: string) => void;
}

const AnsweredRow: React.FC<AnsweredRowProps> = ({ kuestion, onOpen }) => {
  const intl = useIntl();
  const asker = createAccountFromServerJSON(kuestion.asker);
  const handleClick = useCallback(() => {
    onOpen(kuestion.id);
  }, [kuestion.id, onOpen]);

  return (
    <li className='kuestions-answered__row'>
      <button
        type='button'
        className='kuestions-answered__button'
        onClick={handleClick}
      >
        <Avatar account={asker} size={32} />
        <div className='kuestions-answered__body'>
          <div className='kuestions-answered__q'>{kuestion.title}</div>
          <div className='kuestions-answered__meta'>
            {asker.display_name || asker.username} ·{' '}
            {intl.formatMessage(FORMAT_LABEL[kuestion.answer_format])} ·{' '}
            {intl.formatMessage(messages.answersLabel, {
              count: kuestion.answers_count,
            })}
          </div>
        </div>
        <span className='kuestions-answered__unlocked'>
          {intl.formatMessage(messages.unlocked)}
        </span>
      </button>
    </li>
  );
};
