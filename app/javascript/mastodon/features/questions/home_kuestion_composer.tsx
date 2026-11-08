import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateKuestion } from 'mastodon/api/kuestions';
import type { KuestionHome } from 'mastodon/api/kuestions';
import type { KuestionAnswerFormat } from 'mastodon/api_types/kuestions';
import {
  ComposeBody,
  ComposeField,
  ComposeHint,
  ComposeSection,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { FmtOption, McEditor } from './kuestion_composer';

// Ask a Kuestion in a Krew or a projekt (Tal, 2026-11-08: "it probably will
// need its own composer, as the usual kuestion kompose has all the other
// kuestions and other unneccessary pieces"). Only the question and how it's
// answered: no deck or profile choice, no drafts, no Konnect row. It is made
// with the Krew or projekt as its home, so only its members see it
// (docs/spaces/kuestions.md, Kuestions in a Krew).

const messages = defineMessages({
  label: { id: 'kuestions.home_ask.label', defaultMessage: 'Ask the Krew' },
  labelProjekt: {
    id: 'kuestions.home_ask.label_projekt',
    defaultMessage: 'Ask the projekt',
  },
  inKrew: {
    id: 'kuestions.home_ask.in_krew',
    defaultMessage: 'Only the Krew’s members see it and answer it.',
  },
  inProjekt: {
    id: 'kuestions.home_ask.in_projekt',
    defaultMessage: 'Whoever can see the projekt can answer it.',
  },
  question: { id: 'kuestions.home_ask.question', defaultMessage: 'Kuestion' },
  placeholder: {
    id: 'kuestions.home_ask.placeholder',
    defaultMessage: 'What do you want to ask?',
  },
  format: { id: 'kuestions.home_ask.format', defaultMessage: 'Answered with' },
  text: { id: 'kuestions.home_ask.fmt_text', defaultMessage: 'Words' },
  textBody: {
    id: 'kuestions.home_ask.fmt_text_body',
    defaultMessage: 'Everyone writes their own',
  },
  mc: { id: 'kuestions.home_ask.fmt_mc', defaultMessage: 'Choices' },
  mcBody: {
    id: 'kuestions.home_ask.fmt_mc_body',
    defaultMessage: 'Two to four to pick from',
  },
  yn: { id: 'kuestions.home_ask.fmt_yn', defaultMessage: 'Yes or no' },
  ynBody: {
    id: 'kuestions.home_ask.fmt_yn_body',
    defaultMessage: 'A clean split',
  },
  ask: { id: 'kuestions.home_ask.submit', defaultMessage: 'Ask' },
  asking: { id: 'kuestions.home_ask.asking', defaultMessage: 'Asking…' },
  error: {
    id: 'kuestions.home_ask.error',
    defaultMessage: 'Couldn’t ask it. Try again.',
  },
});

const TITLE_MAX = 240;

interface Props {
  home: KuestionHome;
  onCancel: () => void;
  onAsked: () => void;
}

export const HomeKuestionComposer: React.FC<Props> = ({
  home,
  onCancel,
  onAsked,
}) => {
  const intl = useIntl();
  const [text, setText] = useState('');
  const [format, setFormat] = useState<KuestionAnswerFormat>('text');
  const [mcOptions, setMcOptions] = useState<string[]>(['', '']);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const trimmed = text.trim();
  const mcFilled = mcOptions.map((o) => o.trim()).filter(Boolean);
  const canSubmit =
    trimmed.length > 0 && !pending && (format !== 'mc' || mcFilled.length >= 2);

  const handleText = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );
  const pickText = useCallback(() => {
    setFormat('text');
  }, []);
  const pickMc = useCallback(() => {
    setFormat('mc');
  }, []);
  const pickYn = useCallback(() => {
    setFormat('yn');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(false);
    apiCreateKuestion({
      title: trimmed,
      answer_format: format,
      mc_options: format === 'mc' ? mcFilled : undefined,
      kind: 'community',
      krew_id: home.kind === 'krew' ? home.id : undefined,
      project_id: home.kind === 'projekt' ? home.id : undefined,
    })
      .then(() => {
        onAsked();
        return undefined;
      })
      .catch(() => {
        setError(true);
        setPending(false);
      });
  }, [canSubmit, trimmed, format, mcFilled, home, onAsked]);

  const krew = home.kind === 'krew';

  return (
    <ComposeShell
      korner='kuestions'
      label={intl.formatMessage(krew ? messages.label : messages.labelProjekt)}
      subtitle={intl.formatMessage(krew ? messages.inKrew : messages.inProjekt)}
      submitLabel={intl.formatMessage(messages.ask)}
      submittingLabel={intl.formatMessage(messages.asking)}
      submitting={pending}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      <ComposeField label={intl.formatMessage(messages.question)}>
        <ComposeBody
          value={text}
          onChange={handleText}
          maxLength={TITLE_MAX}
          placeholder={intl.formatMessage(messages.placeholder)}
        />
      </ComposeField>

      <ComposeSection title={intl.formatMessage(messages.format)}>
        <div className='kuestions-composer__fmt-grid'>
          <FmtOption
            active={format === 'text'}
            title={intl.formatMessage(messages.text)}
            body={intl.formatMessage(messages.textBody)}
            onSelect={pickText}
          />
          <FmtOption
            active={format === 'mc'}
            title={intl.formatMessage(messages.mc)}
            body={intl.formatMessage(messages.mcBody)}
            onSelect={pickMc}
          />
          <FmtOption
            active={format === 'yn'}
            title={intl.formatMessage(messages.yn)}
            body={intl.formatMessage(messages.ynBody)}
            onSelect={pickYn}
          />
        </div>
      </ComposeSection>

      {format === 'mc' && (
        <McEditor options={mcOptions} onChange={setMcOptions} />
      )}

      {error && (
        <ComposeHint error>{intl.formatMessage(messages.error)}</ComposeHint>
      )}
    </ComposeShell>
  );
};
