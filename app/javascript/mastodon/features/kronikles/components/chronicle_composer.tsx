import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateChronicle, apiUpdateChronicle } from 'mastodon/api/kronikles';
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
  editHeading: {
    id: 'kronikles.composer.edit_heading',
    defaultMessage: 'Edit Kronikle',
  },
  save: { id: 'kronikles.composer.save', defaultMessage: 'Save' },
  saving: { id: 'kronikles.composer.saving', defaultMessage: 'Saving…' },
  deleteChronicle: {
    id: 'kronikles.reader.delete',
    defaultMessage: 'Delete Kronikle',
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
  onCreated?: (chronicle: ApiChronicleJSON) => void;
  // Edit mode: pass the Kronikle to prefill the form. Submit then saves
  // via the update endpoint, and the form's foot carries Delete.
  chronicle?: ApiChronicleJSON;
  onUpdated?: (chronicle: ApiChronicleJSON) => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export const ChronicleComposer: React.FC<Props> = ({
  onCancel,
  onCreated,
  chronicle: editingChronicle,
  onUpdated,
  onDelete,
  deleting = false,
}) => {
  const intl = useIntl();
  const isEdit = !!editingChronicle;
  const [title, setTitle] = useState(editingChronicle?.title ?? '');
  const [body, setBody] = useState(editingChronicle?.body ?? '');
  const [kind, setKind] = useState<ChronicleKind>(
    editingChronicle?.kind ?? 'essay',
  );
  const [visibility, setVisibility] = useState<ReachValue>(
    editingChronicle?.visibility ?? 'public',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      body.trim().length > 0 &&
      !pending &&
      !deleting,
    [title, body, pending, deleting],
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
      const params = { title: title.trim(), body, kind };
      try {
        if (editingChronicle) {
          // Reach is locked while editing — see the ReachDropdown below.
          onUpdated?.(await apiUpdateChronicle(editingChronicle.id, params));
        } else {
          onCreated?.(await apiCreateChronicle({ ...params, visibility }));
        }
      } catch (e) {
        setPending(false);
        setError(
          e instanceof Error
            ? e.message
            : editingChronicle
              ? 'Could not save this Kronikle.'
              : 'Could not publish this Kronikle.',
        );
      }
    })();
  }, [
    canSubmit,
    body,
    editingChronicle,
    kind,
    onCreated,
    onUpdated,
    title,
    visibility,
  ]);

  return (
    <ComposeShell
      korner='kronikles'
      label={intl.formatMessage(
        isEdit ? messages.editHeading : messages.heading,
      )}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(isEdit ? messages.save : messages.submit)}
      submittingLabel={intl.formatMessage(
        isEdit ? messages.saving : messages.submitting,
      )}
      submitting={pending}
      canSubmit={canSubmit}
      headerAction={
        // Reach is locked while editing: the update endpoints don't
        // re-scope the item's projected feed post, so narrowing reach
        // here would only look private (no reach without consent).
        <ReachDropdown
          value={visibility}
          onChange={setVisibility}
          disabled={pending || isEdit}
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

        {isEdit && onDelete && (
          <button
            type='button'
            className='compose-shell__delete'
            onClick={onDelete}
            disabled={pending || deleting}
          >
            {intl.formatMessage(messages.deleteChronicle)}
          </button>
        )}
      </div>
    </ComposeShell>
  );
};
