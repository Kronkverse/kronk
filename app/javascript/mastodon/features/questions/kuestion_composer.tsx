import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateKuestion } from 'mastodon/api/kuestions';
import type {
  ApiKuestionJSON,
  KuestionAnswerFormat,
} from 'mastodon/api_types/kuestions';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { DraftRestoredPill } from 'mastodon/components/draft_restored_pill';
import { useComposerDraft } from 'mastodon/hooks/useComposerDraft';

// Ask a Kuestion (/hub/kuestions/composer) — the standard
// `<ComposeShell>` overlay mounted on top of the current Kuestions
// panel. Was `AskComposer` inside the full-page `AskPanel` at
// /hub/kuestions/ask until 2026-08-12; /hub/kuestions/ask now shows
// the "Yours" panel (MyAsksList only) and the Ж bubble opens this
// overlay via the manifest `compose.route`. Legacy /hub/kuestions/ask
// still auto-opens the overlay so pre-shell muscle memory + bookmarks
// keep working.
//
// Two-stage flow preserved (progressive disclosure of the format
// choice): stage 0 is the 240-char question text, stage 1 is
// format + MC options + review. The shell's primary CTA label
// switches "Next" ↔ "Ask" based on stage.

const messages = defineMessages({
  label: {
    id: 'kuestions.composer.label',
    defaultMessage: 'Ask a Kuestion',
  },
  subtitle: {
    id: 'kuestions.ask.subtitle',
    defaultMessage: "Nobody sees answers until they've given one.",
  },
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
  fmtMc: { id: 'kuestions.ask.fmt_mc', defaultMessage: 'Multiple choice' },
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
  asking: { id: 'kuestions.composer.asking', defaultMessage: 'Asking…' },
  back: { id: 'kuestions.composer.back_stage', defaultMessage: '← Back' },
  error: {
    id: 'kuestions.ask.error',
    defaultMessage: "Couldn't post. Try again.",
  },
});

const TITLE_MAX = 240;
const MC_MIN = 2;
const MC_MAX = 4;

interface Props {
  onCancel: () => void;
  // Fires after a successful create. Parent decides where to navigate
  // (Kuestions sends the caller back to the Yours panel so the fresh
  // kuestion is visible with its running count).
  onCreated: (kuestion: ApiKuestionJSON) => void;
}

export const KuestionComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  const [stage, setStage] = useState<0 | 1>(0);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<KuestionAnswerFormat>('text');
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const mcFilled = mcOptions.filter((o) => o.trim() !== '');
  const canSubmit =
    stage === 0
      ? trimmed !== ''
      : format === 'mc'
        ? mcFilled.length >= MC_MIN
        : true;

  // Draft auto-save: preserve a half-written question across an
  // accidental navigate-away / refresh (docs/rebuild/decisions.md
  // 2026-08-10). Draft snapshot only captures body state — stage is
  // ephemeral; a restored draft always resumes on stage 0.
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
    { enabled: trimmed !== '' && !pending },
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

  const goStage0 = useCallback(() => {
    setStage(0);
    setError(null);
  }, []);

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

  // Shell submit doubles as the stage-forward action:
  //   stage 0 + Next   → advance to stage 1
  //   stage 1 + Ask    → create + hand back to parent
  const handleSubmit = useCallback(() => {
    if (stage === 0) {
      setStage(1);
      return;
    }
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const created = await apiCreateKuestion({
          title: trimmed,
          answer_format: format,
          mc_options: format === 'mc' ? mcFilled : undefined,
        });
        discardDraft();
        onCreated(created);
        // Parent unmounts us on success — no need to reset here.
      } catch {
        setError('ask_failed');
        setPending(false);
      }
    })();
  }, [stage, trimmed, format, mcFilled, discardDraft, onCreated]);

  return (
    <ComposeShell
      korner='kuestions'
      label={intl.formatMessage(messages.label)}
      subtitle={intl.formatMessage(messages.subtitle)}
      submitLabel={intl.formatMessage(
        stage === 0 ? messages.next : messages.ask,
      )}
      submittingLabel={intl.formatMessage(messages.asking)}
      submitting={pending}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <div className='kuestions-composer'>
        {draft.restored && <DraftRestoredPill onDiscard={handleDiscardDraft} />}

        <div className='kuestions-composer__stage-dots'>
          <span className='kuestions-composer__dot kuestions-composer__dot--on' />
          <span
            className={`kuestions-composer__dot ${stage >= 1 ? 'kuestions-composer__dot--on' : ''}`}
          />
        </div>

        {stage === 0 && (
          <>
            <label
              className='kuestions-composer__field-label'
              htmlFor='kuestions-composer-q'
            >
              {intl.formatMessage(messages.qLabel)}
            </label>
            <textarea
              id='kuestions-composer-q'
              className='kuestions-composer__textarea'
              value={text}
              onChange={handleTextChange}
              maxLength={TITLE_MAX}
              placeholder={intl.formatMessage(messages.qPlaceholder)}
            />
            <div className='kuestions-composer__charcount'>
              {text.length}/{TITLE_MAX}
            </div>
          </>
        )}

        {stage === 1 && (
          <>
            <button
              type='button'
              className='kuestions-composer__back'
              onClick={goStage0}
              disabled={pending}
            >
              {intl.formatMessage(messages.back)}
            </button>

            <div className='kuestions-composer__field-label'>
              {intl.formatMessage(messages.fmtLabel)}
            </div>
            <div className='kuestions-composer__fmt-grid'>
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
      </div>
    </ComposeShell>
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
    className={`kuestions-composer__fmt-opt ${active ? 'kuestions-composer__fmt-opt--active' : ''}`}
    aria-pressed={active}
    onClick={onSelect}
  >
    <span className='kuestions-composer__fmt-title'>{title}</span>
    <span className='kuestions-composer__fmt-body'>{body}</span>
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
    <div className='kuestions-composer__mc'>
      <div className='kuestions-composer__field-label'>
        {intl.formatMessage(messages.mcLabel)}
      </div>
      <div className='kuestions-composer__mc-list'>
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
          className='kuestions-composer__mc-add'
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
    <div className='kuestions-composer__mc-input'>
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
          className='kuestions-composer__mc-remove'
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
    <div className='kuestions-composer__review'>
      <div className='kuestions-composer__review-q'>{text || '…'}</div>
      <div className='kuestions-composer__review-fmt'>{fmtLabel}</div>
    </div>
  );
};
