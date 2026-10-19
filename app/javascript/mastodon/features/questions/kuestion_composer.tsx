import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateKuestion } from 'mastodon/api/kuestions';
import type { ApiComposerDraftJSON } from 'mastodon/api_types/drafts';
import type {
  ApiKuestionJSON,
  ApiProfileKuestionJSON,
  KuestionAnswerFormat,
  KuestionProfileFormat,
} from 'mastodon/api_types/kuestions';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useDraft } from 'mastodon/hooks/useDraft';

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
// where it goes + format + MC options + review. The shell's primary CTA
// label switches "Next" ↔ "Ask" based on stage.
//
// Where it goes: the deck (a community Kuestion, answered to unlock) or
// profiles (people answer it for their profile and pin it there; it's
// never posted and has its own typed formats).

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
  kindLabel: {
    id: 'kuestions.ask.kind_label',
    defaultMessage: 'Where does it go?',
  },
  kindDeck: { id: 'kuestions.ask.kind_deck', defaultMessage: 'The deck' },
  kindDeckBody: {
    id: 'kuestions.ask.kind_deck_body',
    defaultMessage: 'Answered to unlock what others said',
  },
  kindProfile: {
    id: 'kuestions.ask.kind_profile',
    defaultMessage: 'For profiles',
  },
  kindProfileBody: {
    id: 'kuestions.ask.kind_profile_body',
    defaultMessage: 'People answer it and pin it to their profile',
  },
  fmtLongtext: {
    id: 'kuestions.ask.fmt_longtext',
    defaultMessage: 'A few lines',
  },
  fmtLongtextBody: {
    id: 'kuestions.ask.fmt_longtext_body',
    defaultMessage: 'A short paragraph',
  },
  fmtList: { id: 'kuestions.ask.fmt_list', defaultMessage: 'A list' },
  fmtListBody: {
    id: 'kuestions.ask.fmt_list_body',
    defaultMessage: 'Things, separated by commas',
  },
  fmtLink: { id: 'kuestions.ask.fmt_link', defaultMessage: 'A link' },
  fmtLinkBody: {
    id: 'kuestions.ask.fmt_link_body',
    defaultMessage: 'A website or profile',
  },
  fmtDate: { id: 'kuestions.ask.fmt_date', defaultMessage: 'A date' },
  fmtDateBody: {
    id: 'kuestions.ask.fmt_date_body',
    defaultMessage: 'A day of the year',
  },
  fmtProfileTextBody: {
    id: 'kuestions.ask.fmt_profile_text_body',
    defaultMessage: 'A word or a line',
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
  back: {
    id: 'kuestions.composer.previous_step',
    defaultMessage: 'Previous',
  },
  error: {
    id: 'kuestions.ask.error',
    defaultMessage: "Couldn't post. Try again.",
  },
});

type KuestionKind = 'community' | 'profile';
type ComposerFormat = KuestionAnswerFormat | KuestionProfileFormat;

const PROFILE_FORMATS: KuestionProfileFormat[] = [
  'text',
  'longtext',
  'list',
  'link',
  'date',
];

const PROFILE_FORMAT_COPY = {
  text: [messages.fmtText, messages.fmtProfileTextBody],
  longtext: [messages.fmtLongtext, messages.fmtLongtextBody],
  list: [messages.fmtList, messages.fmtListBody],
  link: [messages.fmtLink, messages.fmtLinkBody],
  date: [messages.fmtDate, messages.fmtDateBody],
} as const;

const TITLE_MAX = 240;
const MC_MIN = 2;
const MC_MAX = 4;

// What a Kuestion draft keeps (docs/design.md, Drafts). Where it goes
// (deck or profiles) is one of its fields, so both share one set of
// drafts. The wizard step isn't kept: a draft opens on the question.
interface KuestionDraftParams {
  text?: string;
  kind?: KuestionKind;
  format?: ComposerFormat;
  mcOptions?: string[];
}

interface Props {
  onCancel: () => void;
  // Fires after a successful create. Parent decides where to navigate
  // (a deck Kuestion goes to Answered, a profile one to the Profile grid).
  onCreated: (kuestion: ApiKuestionJSON | ApiProfileKuestionJSON) => void;
  // Where it starts: the profile's About you asks a profile Kuestion.
  initialKind?: KuestionKind;
}

export const KuestionComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  initialKind = 'community',
}) => {
  const intl = useIntl();
  const [stage, setStage] = useState<0 | 1>(0);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<KuestionKind>(initialKind);
  const [format, setFormat] = useState<ComposerFormat>('text');
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

  // Drafts: what you've written is saved as you go, here and on the
  // server, and comes back when the composer opens again.
  const applyDraft = useCallback(
    (d: ApiComposerDraftJSON<KuestionDraftParams> | null) => {
      const p = d?.params ?? {};
      setText(p.text ?? '');
      setKind(p.kind ?? initialKind);
      setFormat(p.format ?? 'text');
      setMcOptions(
        p.mcOptions && p.mcOptions.length >= MC_MIN ? p.mcOptions : ['', ''],
      );
      setStage(0);
      setError(null);
    },
    [initialKind],
  );

  const draft = useDraft<KuestionDraftParams>({
    korner: 'kuestions',
    kind: 'kuestion',
    snapshot: { params: { text, kind, format, mcOptions } },
    hasContent: trimmed !== '' || mcFilled.length > 0,
    apply: applyDraft,
    describe: (d) => d.params.text,
    paused: pending,
  });

  const finishDraft = draft.finish;

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

  // Plain text is the one format both kinds share, so switching lands
  // there.
  const setKindDeck = useCallback(() => {
    setKind('community');
    setFormat('text');
  }, []);
  const setKindProfile = useCallback(() => {
    setKind('profile');
    setFormat('text');
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
          kind,
        });
        finishDraft();
        onCreated(created);
        // Parent unmounts us on success — no need to reset here.
      } catch {
        setError('ask_failed');
        setPending(false);
      }
    })();
  }, [stage, trimmed, format, mcFilled, kind, finishDraft, onCreated]);

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
      draft={draft}
    >
      <div className='kuestions-composer'>
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
            {/* Wizard step-back (stage 1 → stage 0). Not a nav back
                — the Frame's SpaceBadge handles korner nav. Uses the
                shared KornerPill primitive with a "Previous" label
                (no arrow) so it reads as wizard-step control, not
                bespoke back button. Retired from the bespoke
                `__back` class 2026-09-03. */}
            <div className='kuestions-composer__wizard-nav'>
              <KornerPill
                label={intl.formatMessage(messages.back)}
                onClick={goStage0}
                disabled={pending}
              />
            </div>

            <div className='kuestions-composer__field-label'>
              {intl.formatMessage(messages.kindLabel)}
            </div>
            <div className='kuestions-composer__fmt-grid kuestions-composer__fmt-grid--two'>
              <FmtOption
                active={kind === 'community'}
                title={intl.formatMessage(messages.kindDeck)}
                body={intl.formatMessage(messages.kindDeckBody)}
                onSelect={setKindDeck}
              />
              <FmtOption
                active={kind === 'profile'}
                title={intl.formatMessage(messages.kindProfile)}
                body={intl.formatMessage(messages.kindProfileBody)}
                onSelect={setKindProfile}
              />
            </div>

            <div className='kuestions-composer__field-label'>
              {intl.formatMessage(messages.fmtLabel)}
            </div>
            {kind === 'profile' ? (
              <div className='kuestions-composer__fmt-grid'>
                {PROFILE_FORMATS.map((f) => (
                  <ProfileFmtOption
                    key={f}
                    format={f}
                    active={format === f}
                    onSelect={setFormat}
                  />
                ))}
              </div>
            ) : (
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
            )}

            {kind === 'community' && format === 'mc' && (
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

interface ProfileFmtOptionProps {
  format: KuestionProfileFormat;
  active: boolean;
  onSelect: (format: KuestionProfileFormat) => void;
}

const ProfileFmtOption: React.FC<ProfileFmtOptionProps> = ({
  format,
  active,
  onSelect,
}) => {
  const intl = useIntl();
  const handleSelect = useCallback(() => {
    onSelect(format);
  }, [format, onSelect]);
  const [title, body] = PROFILE_FORMAT_COPY[format];
  return (
    <FmtOption
      active={active}
      title={intl.formatMessage(title)}
      body={intl.formatMessage(body)}
      onSelect={handleSelect}
    />
  );
};

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
  format: ComposerFormat;
  mcOptions: string[];
}

const AskReview: React.FC<AskReviewProps> = ({ text, format, mcOptions }) => {
  const intl = useIntl();
  const fmtLabel =
    format !== 'text' && format !== 'mc' && format !== 'yn'
      ? intl.formatMessage(PROFILE_FORMAT_COPY[format][0])
      : format === 'text'
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
