import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import type {
  ApiKuestionAnswerJSON,
  ApiKuestionAggregateEntry,
  ApiKuestionJSON,
} from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { RelativeTimestamp } from 'mastodon/components/relative_timestamp';
import { createAccountFromServerJSON } from 'mastodon/models/account';

const messages = defineMessages({
  unlocked: {
    id: 'kuestions.reveal.unlocked',
    defaultMessage: "Unlocked. Here's everyone's.",
  },
  next: { id: 'kuestions.reveal.next', defaultMessage: 'Next kuestion' },
  showMore: {
    id: 'kuestions.reveal.show_more',
    defaultMessage: 'Show {count} more',
  },
  edited: { id: 'kuestions.reveal.edited', defaultMessage: 'edited' },
  viewHistory: {
    id: 'kuestions.reveal.view_history',
    defaultMessage: 'view history',
  },
});

// After a successful answer, the reveal sheet opens: text-format
// renders a paginated feed of everyone's answers; choice-format
// renders per-option aggregate bars with voter avatars.
interface RevealSheetProps {
  kuestion: ApiKuestionJSON;
  onNext: () => void;
}

const PAGE = 4;

export const RevealSheet: React.FC<RevealSheetProps> = ({
  kuestion,
  onNext,
}) => {
  const intl = useIntl();
  const askerName = kuestion.asker.display_name || kuestion.asker.username;

  return (
    <div className='kuestions-sheet-wrap' role='dialog' aria-modal>
      <button
        type='button'
        className='kuestions-sheet-backdrop'
        aria-label={intl.formatMessage(messages.next)}
        onClick={onNext}
      />
      <div className='kuestions-sheet'>
        <div className='kuestions-sheet__grab' aria-hidden />
        <div className='kuestions-reveal__banner'>
          <span className='kuestions-reveal__lock'>
            <svg
              width='15'
              height='15'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              <rect x='3' y='11' width='18' height='11' rx='2' />
              <path d='M7 11V7a5 5 0 0 1 9.9-1' />
            </svg>
          </span>
          <div>
            <b>
              <FormattedMessage
                id='kuestions.reveal.unlocked_title'
                defaultMessage='Unlocked'
              />
            </b>
            <span> {intl.formatMessage(messages.unlocked)}</span>
          </div>
        </div>

        <h2 className='kuestions-sheet__q'>{kuestion.title}</h2>
        <p className='kuestions-sheet__by'>
          <FormattedMessage
            id='kuestions.reveal.asked_by'
            defaultMessage='asked by {asker}'
            values={{ asker: askerName }}
          />
        </p>

        {kuestion.answer_format === 'text' && kuestion.answers && (
          <TextReveal answers={kuestion.answers} />
        )}

        {(kuestion.answer_format === 'mc' || kuestion.answer_format === 'yn') &&
          kuestion.aggregate && <ChoiceReveal aggregate={kuestion.aggregate} />}

        <div className='kuestions-sheet__actions kuestions-sheet__actions--single'>
          <button type='button' className='kuestions-btn' onClick={onNext}>
            {intl.formatMessage(messages.next)}
          </button>
        </div>
      </div>
    </div>
  );
};

const TextReveal: React.FC<{ answers: ApiKuestionAnswerJSON[] }> = ({
  answers,
}) => {
  const intl = useIntl();
  const [shown, setShown] = useState(PAGE);
  const handleMore = useCallback(() => {
    setShown((s) => s + PAGE);
  }, []);

  const slice = answers.slice(0, shown);
  const hasMore = shown < answers.length;

  return (
    <div className='kuestions-reveal__list'>
      {slice.map((a) => (
        <AnswerRow key={a.id} answer={a} />
      ))}
      {hasMore && (
        <button
          type='button'
          className='kuestions-btn kuestions-btn--ghost kuestions-reveal__more'
          onClick={handleMore}
        >
          {intl.formatMessage(messages.showMore, {
            count: Math.min(PAGE, answers.length - shown),
          })}
        </button>
      )}
    </div>
  );
};

const AnswerRow: React.FC<{ answer: ApiKuestionAnswerJSON }> = ({ answer }) => {
  const intl = useIntl();
  const [historyOpen, setHistoryOpen] = useState(false);
  const account = createAccountFromServerJSON(answer.account);
  const displayName = account.display_name || account.username;
  const handle = `@${answer.account.acct}`;

  const handleToggleHistory = useCallback(() => {
    setHistoryOpen((v) => !v);
  }, []);

  return (
    <article
      className={`kuestions-reveal__row ${answer.mine ? 'kuestions-reveal__row--mine' : ''}`}
    >
      <div className='kuestions-reveal__row-head'>
        <Avatar account={account} size={28} />
        <div className='kuestions-reveal__row-who'>
          <div className='kuestions-reveal__row-name'>{displayName}</div>
          <div className='kuestions-reveal__row-handle'>{handle}</div>
        </div>
        {answer.mine && (
          <span className='kuestions-reveal__mine-tag'>
            <FormattedMessage
              id='kuestions.reveal.mine'
              defaultMessage='Yours'
            />
          </span>
        )}
      </div>
      <p className='kuestions-reveal__row-body'>{answer.body}</p>
      {answer.edited && (
        <button
          type='button'
          className='kuestions-reveal__edited'
          onClick={handleToggleHistory}
          aria-expanded={historyOpen}
        >
          {intl.formatMessage(messages.edited)} ·{' '}
          {intl.formatMessage(messages.viewHistory)}
        </button>
      )}
      {historyOpen && (
        <ul className='kuestions-reveal__history'>
          {answer.edit_history.map((h, i) => (
            <li
              key={`${answer.id}-h-${i}`}
              className='kuestions-reveal__history-row'
            >
              <RelativeTimestamp timestamp={h.edited_at} short />
              <span>{h.body}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

const ChoiceReveal: React.FC<{ aggregate: ApiKuestionAggregateEntry[] }> = ({
  aggregate,
}) => {
  const total = aggregate.reduce((sum, o) => sum + o.count, 0) || 1;

  return (
    <div className='kuestions-reveal__aggregate'>
      {aggregate.map((option) => {
        const pct = Math.round((option.count / total) * 100);
        const overflow = Math.max(0, option.voters.length - 5);
        return (
          <div key={option.label} className='kuestions-reveal__agg-row'>
            <div className='kuestions-reveal__agg-top'>
              <span className='kuestions-reveal__agg-label'>
                {option.label}
              </span>
              <span className='kuestions-reveal__agg-pct'>
                {option.count} · {pct}%
              </span>
            </div>
            <div className='kuestions-reveal__agg-bar'>
              <div
                className='kuestions-reveal__agg-fill'
                style={{ width: `${pct}%` }}
              />
            </div>
            {option.voters.length > 0 && (
              <div className='kuestions-reveal__agg-faces'>
                {option.voters.slice(0, 5).map((v) => (
                  <VoterAvatar key={v.id} voter={v} />
                ))}
                {overflow > 0 && (
                  <div className='kuestions-reveal__agg-overflow'>
                    +{overflow}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// The aggregate voter payload is a slim projection (not a full
// ApiAccountJSON); the Avatar component wants the account shape,
// so we build a minimal one to feed it a URL + acct.
const VoterAvatar: React.FC<{
  voter: ApiKuestionAggregateEntry['voters'][number];
}> = ({ voter }) => {
  return (
    <span
      className='kuestions-reveal__agg-face'
      title={voter.display_name || voter.acct}
    >
      <img src={voter.avatar} alt='' />
    </span>
  );
};
