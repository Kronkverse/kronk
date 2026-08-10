import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import {
  apiCreateKuestion,
  apiGetKuestion,
  apiListMyKuestions,
} from 'mastodon/api/kuestions';
import type {
  ApiKuestionJSON,
  KuestionAnswerFormat,
} from 'mastodon/api_types/kuestions';
import { Avatar } from 'mastodon/components/avatar';
import { DraftRestoredPill } from 'mastodon/components/draft_restored_pill';
import { useComposerDraft } from 'mastodon/hooks/useComposerDraft';
import { createAccountFromServerJSON } from 'mastodon/models/account';

import { AnswerSheet } from './answer_sheet';
import { RevealSheet } from './reveal_sheet';

const messages = defineMessages({
  qLabel: {
    id: 'kuestions.ask.q_label',
    defaultMessage: 'Your kuestion',
  },
  qPlaceholder: {
    id: 'kuestions.ask.q_placeholder',
    defaultMessage: 'What do you want to know?',
  },
  fmtLabel: {
    id: 'kuestions.ask.fmt_label',
    defaultMessage: 'How should people answer?',
  },
  fmtText: { id: 'kuestions.ask.fmt_text', defaultMessage: 'Free text' },
  fmtTextBody: {
    id: 'kuestions.ask.fmt_text_body',
    defaultMessage: 'Open answers, shown as a feed',
  },
  fmtMc: {
    id: 'kuestions.ask.fmt_mc',
    defaultMessage: 'Multiple choice',
  },
  fmtMcBody: {
    id: 'kuestions.ask.fmt_mc_body',
    defaultMessage: '2–4 options, shown as a chart',
  },
  fmtYn: { id: 'kuestions.ask.fmt_yn', defaultMessage: 'Yes / No' },
  fmtYnBody: {
    id: 'kuestions.ask.fmt_yn_body',
    defaultMessage: 'A clean split',
  },
  mcLabel: { id: 'kuestions.ask.mc_label', defaultMessage: 'Options' },
  mcAdd: { id: 'kuestions.ask.mc_add', defaultMessage: '+ Add option' },
  mcPlaceholder: {
    id: 'kuestions.ask.mc_option_placeholder',
    defaultMessage: 'Option {n}',
  },
  next: { id: 'kuestions.ask.next', defaultMessage: 'Next' },
  ask: { id: 'kuestions.ask.submit', defaultMessage: 'Ask' },
  backToDeck: {
    id: 'kuestions.ask.back_to_deck',
    defaultMessage: 'Back to deck',
  },
  back: { id: 'kuestions.ask.back', defaultMessage: 'Back' },
  error: {
    id: 'kuestions.ask.error',
    defaultMessage: "Couldn't post. Try again.",
  },
  formatText: { id: 'kuestions.format.text', defaultMessage: 'Free text' },
  formatMc: { id: 'kuestions.format.mc', defaultMessage: 'Multiple choice' },
  formatYn: { id: 'kuestions.format.yn', defaultMessage: 'Yes / No' },
  answersLabel: {
    id: 'kuestions.ask.answers_label',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  addOwnAnswer: {
    id: 'kuestions.ask.add_own_answer',
    defaultMessage: 'Answer your own',
  },
  seeAnswers: {
    id: 'kuestions.ask.see_answers',
    defaultMessage: 'See answers',
  },
  myAsksHeading: {
    id: 'kuestions.ask.my_asks_heading',
    defaultMessage: 'Your kuestions',
  },
  myAsksEmpty: {
    id: 'kuestions.ask.my_asks_empty',
    defaultMessage: "You haven't asked anything yet.",
  },
  myAsksLoading: {
    id: 'kuestions.ask.my_asks_loading',
    defaultMessage: 'Loading your kuestions…',
  },
});

const TITLE_MAX = 240;
const MC_MIN = 2;
const MC_MAX = 4;

const FORMAT_LABEL = {
  text: messages.formatText,
  mc: messages.formatMc,
  yn: messages.formatYn,
} as const;

interface AskPanelProps {
  onDone: () => void;
}

// Ask surface = composer + My-asks list. Submitting the composer keeps
// the user on Ask (composer resets, list refreshes), so a kuestion they
// just posted is visible immediately with its running count and answers.
// The "Back to Deck" button on the composer's first stage is the only
// path that fires `onDone`.
export const AskPanel: React.FC<AskPanelProps> = ({ onDone }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitted = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <AskComposer onDone={onDone} onSubmitted={handleSubmitted} />
      <MyAsksList refreshKey={refreshKey} />
    </>
  );
};

interface AskComposerProps {
  onDone: () => void;
  onSubmitted: () => void;
}

// Two-stage composer per prototype:
//   Stage 0 — 240-char kuestion text.
//   Stage 1 — pick format (text/mc/yn) + MC options if mc.
// Submit posts via apiCreateKuestion; on success resets to stage 0 and
// notifies the parent so the My-asks list refetches.
const AskComposer: React.FC<AskComposerProps> = ({ onDone, onSubmitted }) => {
  const intl = useIntl();
  const [stage, setStage] = useState<0 | 1>(0);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<KuestionAnswerFormat>('text');
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const mcFilled = mcOptions.filter((o) => o.trim() !== '');
  const canNext =
    stage === 0
      ? trimmed !== ''
      : format === 'mc'
        ? mcFilled.length >= MC_MIN
        : true;

  // Draft auto-save: preserve a half-written question across an accidental
  // navigate-away / refresh (docs/rebuild/decisions.md 2026-08-10).
  const draftSnapshot = useMemo(
    () => ({ text, format, mcOptions }),
    [text, format, mcOptions],
  );
  const handleRestore = useCallback(
    (d: {
      text: string;
      format: KuestionAnswerFormat;
      mcOptions: string[];
    }) => {
      setText(d.text);
      setFormat(d.format);
      setMcOptions(d.mcOptions.length >= MC_MIN ? d.mcOptions : ['', '']);
    },
    [],
  );
  const draft = useComposerDraft(
    'kuestions:ask',
    draftSnapshot,
    handleRestore,
    {
      enabled: trimmed !== '' && !pending,
    },
  );
  const discardDraft = draft.discard;
  const handleDiscardDraft = useCallback(() => {
    setText('');
    setMcOptions(['', '']);
    setFormat('text');
    setStage(0);
    setError(null);
    discardDraft();
  }, [discardDraft]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value.slice(0, TITLE_MAX));
    },
    [],
  );

  const goStage1 = useCallback(() => {
    setStage(1);
  }, []);

  const goStage0 = useCallback(() => {
    setStage(0);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    if (stage === 1) {
      goStage0();
    } else {
      onDone();
    }
  }, [stage, goStage0, onDone]);

  const submit = useCallback(() => {
    if (pending) return;
    if (!trimmed) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        await apiCreateKuestion({
          title: trimmed,
          answer_format: format,
          mc_options: format === 'mc' ? mcFilled : undefined,
        });
        setText('');
        setMcOptions(['', '']);
        setFormat('text');
        setStage(0);
        setPending(false);
        discardDraft();
        onSubmitted();
      } catch {
        setError('ask_failed');
        setPending(false);
      }
    })();
  }, [format, mcFilled, onSubmitted, pending, trimmed, discardDraft]);

  const handleNext = useCallback(() => {
    if (stage === 0) {
      goStage1();
    } else {
      submit();
    }
  }, [stage, goStage1, submit]);

  const setFmtText = useCallback(() => {
    setFormat('text');
  }, []);
  const setFmtMc = useCallback(() => {
    setFormat('mc');
    setMcOptions((prev) => (prev.length >= MC_MIN ? prev : ['', '']));
  }, []);
  const setFmtYn = useCallback(() => {
    setFormat('yn');
  }, []);

  return (
    <section className='kuestions-panel'>
      <p className='space-subtitle'>
        <FormattedMessage
          id='kuestions.ask.subtitle'
          defaultMessage="Nobody sees answers until they've given one."
        />
      </p>

      <div className='kuestions-ask'>
        {draft.restored && <DraftRestoredPill onDiscard={handleDiscardDraft} />}

        <div className='kuestions-ask__stage-dots'>
          <span className='kuestions-ask__dot kuestions-ask__dot--on' />
          <span
            className={`kuestions-ask__dot ${stage >= 1 ? 'kuestions-ask__dot--on' : ''}`}
          />
        </div>

        {stage === 0 && (
          <>
            <label
              className='kuestions-ask__field-label'
              htmlFor='kuestions-ask-q'
            >
              {intl.formatMessage(messages.qLabel)}
            </label>
            <textarea
              id='kuestions-ask-q'
              className='kuestions-ask__textarea'
              value={text}
              onChange={handleTextChange}
              maxLength={TITLE_MAX}
              placeholder={intl.formatMessage(messages.qPlaceholder)}
            />
            <div className='kuestions-ask__charcount'>
              {text.length}/{TITLE_MAX}
            </div>
          </>
        )}

        {stage === 1 && (
          <>
            <div className='kuestions-ask__field-label'>
              {intl.formatMessage(messages.fmtLabel)}
            </div>
            <div className='kuestions-ask__fmt-grid'>
              <FmtOption
                active={format === 'text'}
                title={intl.formatMessage(messages.fmtText)}
                body={intl.formatMessage(messages.fmtTextBody)}
                onSelect={setFmtText}
              />
              <FmtOption
                active={format === 'mc'}
                title={intl.formatMessage(messages.fmtMc)}
                body={intl.formatMessage(messages.fmtMcBody)}
                onSelect={setFmtMc}
              />
              <FmtOption
                active={format === 'yn'}
                title={intl.formatMessage(messages.fmtYn)}
                body={intl.formatMessage(messages.fmtYnBody)}
                onSelect={setFmtYn}
              />
            </div>

            {format === 'mc' && (
              <McEditor options={mcOptions} onChange={setMcOptions} />
            )}

            <AskReview text={trimmed} format={format} mcOptions={mcFilled} />
          </>
        )}

        {error && (
          <p className='kuestions-sheet__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}

        <div className='kuestions-ask__actions'>
          <button
            type='button'
            className='kuestions-btn kuestions-btn--ghost'
            onClick={handleBack}
            disabled={pending}
          >
            {stage === 0
              ? intl.formatMessage(messages.backToDeck)
              : intl.formatMessage(messages.back)}
          </button>
          <button
            type='button'
            className='kuestions-btn'
            onClick={handleNext}
            disabled={!canNext || pending}
          >
            {stage === 0
              ? intl.formatMessage(messages.next)
              : intl.formatMessage(messages.ask)}
          </button>
        </div>
      </div>
    </section>
  );
};

interface FmtOptionProps {
  active: boolean;
  title: string;
  body: string;
  onSelect: () => void;
}

const FmtOption: React.FC<FmtOptionProps> = ({
  active,
  title,
  body,
  onSelect,
}) => (
  <button
    type='button'
    className={`kuestions-ask__fmt-opt ${active ? 'kuestions-ask__fmt-opt--active' : ''}`}
    aria-pressed={active}
    onClick={onSelect}
  >
    <span className='kuestions-ask__fmt-title'>{title}</span>
    <span className='kuestions-ask__fmt-body'>{body}</span>
  </button>
);

interface McEditorProps {
  options: string[];
  onChange: (next: string[]) => void;
}

const McEditor: React.FC<McEditorProps> = ({ options, onChange }) => {
  const intl = useIntl();

  const handleOptionInput = useCallback(
    (idx: number, value: string) => {
      onChange(options.map((o, i) => (i === idx ? value : o)));
    },
    [onChange, options],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      onChange(options.filter((_, i) => i !== idx));
    },
    [onChange, options],
  );

  const handleAdd = useCallback(() => {
    if (options.length >= MC_MAX) return;
    onChange([...options, '']);
  }, [onChange, options]);

  const canRemove = options.length > MC_MIN;
  const canAdd = options.length < MC_MAX;

  return (
    <div className='kuestions-ask__mc'>
      <div className='kuestions-ask__field-label'>
        {intl.formatMessage(messages.mcLabel)}
      </div>
      <div className='kuestions-ask__mc-list'>
        {options.map((value, idx) => (
          <McInputRow
            key={`mc-${idx}`}
            index={idx}
            value={value}
            onInput={handleOptionInput}
            onRemove={handleRemove}
            canRemove={canRemove}
          />
        ))}
      </div>
      {canAdd && (
        <button
          type='button'
          className='kuestions-ask__mc-add'
          onClick={handleAdd}
        >
          {intl.formatMessage(messages.mcAdd)}
        </button>
      )}
    </div>
  );
};

interface McInputRowProps {
  index: number;
  value: string;
  onInput: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}

const McInputRow: React.FC<McInputRowProps> = ({
  index,
  value,
  onInput,
  onRemove,
  canRemove,
}) => {
  const intl = useIntl();
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onInput(index, e.target.value);
    },
    [index, onInput],
  );
  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [index, onRemove]);
  return (
    <div className='kuestions-ask__mc-input'>
      <input
        type='text'
        value={value}
        onChange={handleInput}
        placeholder={intl.formatMessage(messages.mcPlaceholder, {
          n: index + 1,
        })}
      />
      {canRemove && (
        <button
          type='button'
          className='kuestions-ask__mc-remove'
          onClick={handleRemove}
          aria-label='Remove option'
        >
          ×
        </button>
      )}
    </div>
  );
};

interface AskReviewProps {
  text: string;
  format: KuestionAnswerFormat;
  mcOptions: string[];
}

const AskReview: React.FC<AskReviewProps> = ({ text, format, mcOptions }) => {
  const intl = useIntl();
  const fmtLabel =
    format === 'text'
      ? intl.formatMessage(messages.fmtText)
      : format === 'mc'
        ? `${intl.formatMessage(messages.fmtMc)} · ${mcOptions.join(' / ') || '…'}`
        : `${intl.formatMessage(messages.fmtYn)} · Yes / No`;
  return (
    <div className='kuestions-ask__review'>
      <div className='kuestions-ask__review-q'>{text || '…'}</div>
      <div className='kuestions-ask__review-fmt'>{fmtLabel}</div>
    </div>
  );
};

interface MyAsksListProps {
  refreshKey: number;
}

// My asks — the caller's own kuestions with their running count and,
// for anything they haven't answered yet, an "Answer your own" button
// (asker is exempt from the visibility gate; the answer sheet is the
// same one the Deck uses). Tapping "See answers" opens the reveal
// sheet, which under the asker-bypass shows every answer regardless of
// whether the asker has locked in one of their own.
const MyAsksList: React.FC<MyAsksListProps> = ({ refreshKey }) => {
  const intl = useIntl();
  const [list, setList] = useState<ApiKuestionJSON[] | null>(null);
  const [answering, setAnswering] = useState<ApiKuestionJSON | null>(null);
  const [revealing, setRevealing] = useState<ApiKuestionJSON | null>(null);

  useEffect(() => {
    void (async () => {
      setList(null);
      try {
        const data = await apiListMyKuestions();
        setList(data);
      } catch {
        setList([]);
      }
    })();
  }, [refreshKey]);

  const openReveal = useCallback((id: string) => {
    void (async () => {
      try {
        const detail = await apiGetKuestion(id);
        setRevealing(detail);
      } catch {
        // Silent — reveal is opportunistic, no strong error UI yet.
      }
    })();
  }, []);

  const openAnswer = useCallback((k: ApiKuestionJSON) => {
    setAnswering(k);
  }, []);

  const closeAnswer = useCallback(() => {
    setAnswering(null);
  }, []);

  const closeReveal = useCallback(() => {
    setRevealing(null);
  }, []);

  const handleAnswered = useCallback((updated: ApiKuestionJSON) => {
    setAnswering(null);
    setList((prev) =>
      prev ? prev.map((k) => (k.id === updated.id ? updated : k)) : prev,
    );
    setRevealing(updated);
  }, []);

  if (list === null) {
    return (
      <section className='kuestions-panel'>
        <p className='space-subtitle'>
          {intl.formatMessage(messages.myAsksLoading)}
        </p>
      </section>
    );
  }

  if (list.length === 0) {
    return (
      <section className='kuestions-panel'>
        <h3 className='kuestions-ask__my-heading'>
          {intl.formatMessage(messages.myAsksHeading)}
        </h3>
        <p className='space-subtitle'>
          {intl.formatMessage(messages.myAsksEmpty)}
        </p>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <h3 className='kuestions-ask__my-heading'>
        {intl.formatMessage(messages.myAsksHeading)}
      </h3>

      <ul className='kuestions-answered'>
        {list.map((k) => (
          <MyAskRow
            key={k.id}
            kuestion={k}
            onSeeAnswers={openReveal}
            onAnswer={openAnswer}
          />
        ))}
      </ul>

      {answering && (
        <AnswerSheet
          kuestion={answering}
          defaultScope='mates'
          onCancel={closeAnswer}
          onSubmitted={handleAnswered}
        />
      )}
      {revealing && <RevealSheet kuestion={revealing} onNext={closeReveal} />}
    </section>
  );
};

interface MyAskRowProps {
  kuestion: ApiKuestionJSON;
  onSeeAnswers: (id: string) => void;
  onAnswer: (k: ApiKuestionJSON) => void;
}

const MyAskRow: React.FC<MyAskRowProps> = ({
  kuestion,
  onSeeAnswers,
  onAnswer,
}) => {
  const intl = useIntl();
  const asker = createAccountFromServerJSON(kuestion.asker);

  const handleSeeAnswers = useCallback(() => {
    onSeeAnswers(kuestion.id);
  }, [kuestion.id, onSeeAnswers]);

  const handleAnswer = useCallback(() => {
    onAnswer(kuestion);
  }, [kuestion, onAnswer]);

  return (
    <li className='kuestions-answered__row'>
      <div className='kuestions-answered__button kuestions-answered__button--static'>
        <Avatar account={asker} size={32} />
        <div className='kuestions-answered__body'>
          <div className='kuestions-answered__q'>{kuestion.title}</div>
          <div className='kuestions-answered__meta'>
            {intl.formatMessage(FORMAT_LABEL[kuestion.answer_format])} ·{' '}
            {intl.formatMessage(messages.answersLabel, {
              count: kuestion.answers_count,
            })}
          </div>
        </div>
        <div className='kuestions-answered__actions'>
          {!kuestion.has_answered && (
            <button
              type='button'
              className='kuestions-btn kuestions-btn--ghost kuestions-btn--sm'
              onClick={handleAnswer}
            >
              {intl.formatMessage(messages.addOwnAnswer)}
            </button>
          )}
          <button
            type='button'
            className='kuestions-btn kuestions-btn--sm'
            onClick={handleSeeAnswers}
          >
            {intl.formatMessage(messages.seeAnswers)}
          </button>
        </div>
      </div>
    </li>
  );
};
