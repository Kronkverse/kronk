import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiCreateChronicle,
  apiUpdateChronicle,
  apiUploadChroniclePicture,
} from 'mastodon/api/kronikles';
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
  headingTool: {
    id: 'kronikles.composer.heading_tool',
    defaultMessage: 'Heading',
  },
  picture: {
    id: 'kronikles.composer.picture',
    defaultMessage: 'Add a picture',
  },
  pictureUploading: {
    id: 'kronikles.composer.picture_uploading',
    defaultMessage: 'Uploading…',
  },
  pictureFailed: {
    id: 'kronikles.composer.picture_failed',
    defaultMessage: 'That picture didn’t upload. Try again.',
  },
  pictureHint: {
    id: 'kronikles.composer.picture_hint',
    defaultMessage:
      'A picture sits where its line is in your text. Type between the square brackets to give it a caption; delete the line to remove it.',
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

  // Pictures between paragraphs (Tal 2026-10-12). A picture is uploaded
  // on its own and the body names it on a line: `![caption](picture:<id>)`.
  // The thumbnails under the box are only so the writer can tell which
  // line is which picture.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState<{ id: string; src: string }[]>(() =>
    (editingChronicle?.pictures ?? []).map((p) => ({
      id: p.id,
      src: p.preview_url,
    })),
  );

  // Put `text` into the body where the cursor is (or at the end).
  const insertAtCursor = useCallback((text: string, wholeLine: boolean) => {
    const el = bodyRef.current;
    setBody((current) => {
      const at = el ? el.selectionStart : current.length;
      if (!wholeLine) {
        // A prefix for the line the cursor is on.
        const lineStart = current.lastIndexOf('\n', at - 1) + 1;
        return current.slice(0, lineStart) + text + current.slice(lineStart);
      }
      const before = current.slice(0, at).replace(/\n*$/, '');
      const after = current.slice(at).replace(/^\n*/, '');
      return `${before}${before ? '\n\n' : ''}${text}\n\n${after}`;
    });
    el?.focus();
  }, []);

  const handleHeading = useCallback(() => {
    insertAtCursor('## ', false);
  }, [insertAtCursor]);

  const handlePickPicture = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handlePictureChosen = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(true);
      setError(null);
      apiUploadChroniclePicture(file)
        .then((media) => {
          insertAtCursor(`![](picture:${media.id})`, true);
          if (media.preview_url) {
            const src = media.preview_url;
            setThumbs((prev) => [...prev, { id: media.id, src }]);
          }
          return undefined;
        })
        .catch(() => {
          setError(intl.formatMessage(messages.pictureFailed));
        })
        .finally(() => {
          setUploading(false);
        });
    },
    [insertAtCursor, intl],
  );

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

        <div className='kronikles-composer__tools'>
          <button type='button' onClick={handleHeading} disabled={pending}>
            {intl.formatMessage(messages.headingTool)}
          </button>
          <button
            type='button'
            onClick={handlePickPicture}
            disabled={pending || uploading}
          >
            {intl.formatMessage(
              uploading ? messages.pictureUploading : messages.picture,
            )}
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='image/*'
            className='kronikles-composer__file'
            aria-label={intl.formatMessage(messages.picture)}
            onChange={handlePictureChosen}
          />
        </div>

        <textarea
          ref={bodyRef}
          className='kronikles-composer__body'
          value={body}
          onChange={handleBodyChange}
          placeholder={intl.formatMessage(messages.bodyPlaceholder)}
          disabled={pending}
        />

        {thumbs.some((t) => body.includes(`(picture:${t.id})`)) && (
          <div className='kronikles-composer__pictures'>
            <p>{intl.formatMessage(messages.pictureHint)}</p>
            <ul>
              {thumbs
                .filter((t) => body.includes(`(picture:${t.id})`))
                .map((t) => (
                  <li key={t.id}>
                    <img src={t.src} alt='' />
                    <code>picture:{t.id}</code>
                  </li>
                ))}
            </ul>
          </div>
        )}

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
