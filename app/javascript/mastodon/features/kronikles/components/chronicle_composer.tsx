import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateChronicle } from 'mastodon/api/kronikles';
import type {
  ApiChronicleJSON,
  ChronicleKind,
} from 'mastodon/api_types/kronikles';
import { ComposeShell } from 'mastodon/components/compose_shell';
import type { ReachValue } from 'mastodon/components/reach_dropdown';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';

const messages = defineMessages({
  submit: { id: 'kronikles.composer.submit', defaultMessage: 'Publish' },
  submitting: {
    id: 'kronikles.composer.submitting',
    defaultMessage: 'Publishing…',
  },
  heading: {
    id: 'kronikles.composer.heading',
    defaultMessage: 'Start a Kronikle',
  },
  titlePlaceholder: {
    id: 'kronikles.composer.title_placeholder',
    defaultMessage: 'Title',
  },
  bodyPlaceholder: {
    id: 'kronikles.composer.body_placeholder',
    defaultMessage:
      'Write your piece. Markdown works — # headings, **bold**, *italic*, > blockquotes, - lists.',
  },
  kindLabel: { id: 'kronikles.composer.kind_label', defaultMessage: 'Kind' },
});

const KINDS: readonly ChronicleKind[] = [
  'essay',
  'short_story',
  'poetry',
  'letter',
  'journal',
  'other',
];

const kindMessages = defineMessages({
  essay: { id: 'kronikles.kind.essay', defaultMessage: 'Essay' },
  short_story: {
    id: 'kronikles.kind.short_story',
    defaultMessage: 'Short story',
  },
  poetry: { id: 'kronikles.kind.poetry', defaultMessage: 'Poetry' },
  letter: { id: 'kronikles.kind.letter', defaultMessage: 'Letter' },
  journal: { id: 'kronikles.kind.journal', defaultMessage: 'Journal' },
  other: { id: 'kronikles.kind.other', defaultMessage: 'Other' },
});

interface Props {
  onCancel: () => void;
  onCreated: (chronicle: ApiChronicleJSON) => void;
}

export const ChronicleComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<ChronicleKind>('essay');
  const [visibility, setVisibility] = useState<ReachValue>('public');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && body.trim().length > 0 && !pending,
    [title, body, pending],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );
  const handleKindChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setKind(e.target.value as ChronicleKind);
    },
    [],
  );

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const chronicle = await apiCreateChronicle({
          title: title.trim(),
          body,
          kind,
          visibility,
        });
        onCreated(chronicle);
      } catch (e) {
        setPending(false);
        setError(
          e instanceof Error ? e.message : 'Could not publish this Kronikle.',
        );
      }
    })();
  }, [canSubmit, body, kind, onCreated, title, visibility]);

  return (
    <ComposeShell
      korner='kronikles'
      label={intl.formatMessage(messages.heading)}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.submitting)}
      submitting={pending}
      canSubmit={canSubmit}
      headerAction={
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={pending}
        />
      }
    >
      <div className='kronikles-composer'>
        <input
          type='text'
          className='kronikles-composer__title'
          value={title}
          onChange={handleTitleChange}
          placeholder={intl.formatMessage(messages.titlePlaceholder)}
          maxLength={240}
          disabled={pending}
        />

        <div className='kronikles-composer__kind'>
          <label htmlFor='kronikles-composer-kind'>
            {intl.formatMessage(messages.kindLabel)}
          </label>
          <select
            id='kronikles-composer-kind'
            value={kind}
            onChange={handleKindChange}
            disabled={pending}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {intl.formatMessage(kindMessages[k])}
              </option>
            ))}
          </select>
        </div>

        <textarea
          className='kronikles-composer__body'
          value={body}
          onChange={handleBodyChange}
          placeholder={intl.formatMessage(messages.bodyPlaceholder)}
          disabled={pending}
        />

        {error && <p className='kronikles-composer__error'>{error}</p>}
      </div>
    </ComposeShell>
  );
};
