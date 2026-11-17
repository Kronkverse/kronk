import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import {
  ComposeBody,
  ComposeHint,
  ComposeInput,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';

import { formatDuration } from '../format';
import { SAMPLE_SECONDS_MAX } from '../samples';
import type { BoothSample, BoothSamplePack } from '../types';

import { readDuration, trackTitleFromFile } from './album_tracks_field';
import { ComposerSwitch } from './composer_switch';
import { SampleFields, blankDetails, detailsPayload } from './sample_fields';
import type { SampleDetails } from './sample_fields';

// Share samples (docs/spaces/booth.md, Samples), the third face of the
// Booth's composer at /hub/booth/composer/sample. One sample, or a pack:
// several files under one title and cover, the way an album holds tracks.
// `?pack=<id>` adds more to a pack you already have. Each file is up to two
// minutes; the server checks that too.

const messages = defineMessages({
  shellLabel: {
    id: 'booth.sample.compose.label',
    defaultMessage: 'Share samples',
  },
  submit: { id: 'booth.sample.compose.submit', defaultMessage: 'Share' },
  submitting: {
    id: 'booth.sample.compose.submitting',
    defaultMessage: 'Uploading {number} of {count}…',
  },
  shape: {
    id: 'booth.sample.compose.shape',
    defaultMessage: 'What are you sharing?',
  },
  one: { id: 'booth.sample.compose.one', defaultMessage: 'One sample' },
  pack: { id: 'booth.sample.compose.pack', defaultMessage: 'A pack' },
  addingTo: {
    id: 'booth.sample.compose.adding_to',
    defaultMessage: 'Adding to {pack}',
  },
  files: { id: 'booth.sample.compose.files', defaultMessage: 'Audio files' },
  file: { id: 'booth.sample.compose.file', defaultMessage: 'Audio file' },
  pickOne: {
    id: 'booth.sample.compose.pick_one',
    defaultMessage: 'Choose an audio file',
  },
  pickMany: {
    id: 'booth.sample.compose.pick_many',
    defaultMessage: 'Choose audio files',
  },
  pickMore: {
    id: 'booth.sample.compose.pick_more',
    defaultMessage: 'Add more files',
  },
  fileHint: {
    id: 'booth.sample.compose.file_hint',
    defaultMessage: 'MP3, WAV, FLAC or M4A, up to two minutes each.',
  },
  tooLong: {
    id: 'booth.sample.compose.too_long',
    defaultMessage: 'Longer than two minutes. Trim it to share it as a sample.',
  },
  sampleTitle: {
    id: 'booth.sample.compose.sample_title',
    defaultMessage: 'Name of sample {number}',
  },
  remove: { id: 'booth.sample.compose.remove', defaultMessage: 'Remove' },
  title: { id: 'booth.sample.compose.title', defaultMessage: 'Name it' },
  packTitle: {
    id: 'booth.sample.compose.pack_title',
    defaultMessage: 'Name the pack',
  },
  packAbout: {
    id: 'booth.sample.compose.pack_about',
    defaultMessage: 'What’s in it (optional)',
  },
  cover: {
    id: 'booth.sample.compose.cover',
    defaultMessage: 'Cover image (optional)',
  },
  pickCover: {
    id: 'booth.upload.pick_cover',
    defaultMessage: 'Choose cover image',
  },
  replace: { id: 'booth.upload.replace_file', defaultMessage: 'Replace' },
  packDetails: {
    id: 'booth.sample.compose.pack_details',
    defaultMessage:
      'These go on every sample in the pack. You can change one on its own page.',
  },
  failed: {
    id: 'booth.sample.compose.failed',
    defaultMessage: 'Couldn’t share it: {reason}',
  },
  failedTryAgain: {
    id: 'booth.sample.compose.failed_try_again',
    defaultMessage: 'Couldn’t share it. Please try again.',
  },
});

const PACK_MAX = 30;

interface FileDraft {
  key: string;
  file: File;
  title: string;
  // Read by the browser before upload; null until then, or if it can't.
  seconds: number | null;
}

const tooLong = (draft: FileDraft) =>
  draft.seconds !== null && draft.seconds > SAMPLE_SECONDS_MAX;

async function uploadMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  // v1 processes the file before answering, so the server can read how
  // long it is.
  const res = await api().post<{ id: string }>('/api/v1/media', form);
  return res.data.id;
}

const FileRow: React.FC<{
  draft: FileDraft;
  index: number;
  disabled: boolean;
  onTitle: (key: string, title: string) => void;
  onRemove: (key: string) => void;
}> = ({ draft, index, disabled, onTitle, onRemove }) => {
  const intl = useIntl();
  const handleTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onTitle(draft.key, e.target.value);
    },
    [onTitle, draft.key],
  );
  const handleRemove = useCallback(() => {
    onRemove(draft.key);
  }, [onRemove, draft.key]);

  return (
    <li className='booth-album-field__track'>
      <span className='booth-album-field__number'>{index + 1}</span>
      <ComposeInput
        value={draft.title}
        onChange={handleTitle}
        maxLength={200}
        required
        disabled={disabled}
        aria-label={intl.formatMessage(messages.sampleTitle, {
          number: index + 1,
        })}
      />
      <span className='booth-album-field__length'>
        {formatDuration(draft.seconds)}
      </span>
      <button
        type='button'
        onClick={handleRemove}
        disabled={disabled}
        aria-label={intl.formatMessage(messages.remove)}
        title={intl.formatMessage(messages.remove)}
      >
        <Icon id='close' icon={CloseIcon} />
      </button>
      {tooLong(draft) && (
        <span className='booth-upload-form__file-error' role='alert'>
          {intl.formatMessage(messages.tooLong)}
        </span>
      )}
    </li>
  );
};

interface Props {
  onCancel: () => void;
  // The sample, or the pack when there was more than one, to open next.
  onShared: (to: string) => void;
}

export const SampleComposer: React.FC<Props> = ({ onCancel, onShared }) => {
  const intl = useIntl();
  const { search } = useLocation();
  const packParam = new URLSearchParams(search).get('pack');
  const [existingPack, setExistingPack] = useState<BoothSamplePack | null>(
    null,
  );
  const [packMode, setPackMode] = useState(false);
  const [files, setFiles] = useState<FileDraft[]>([]);
  const [title, setTitle] = useState('');
  const [packTitle, setPackTitle] = useState('');
  const [packAbout, setPackAbout] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [details, setDetails] = useState<SampleDetails>(blankDetails);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const nextKey = useRef(0);

  // Adding to a pack you have: its samples take its details as a start.
  useEffect(() => {
    if (!packParam) return;
    void api()
      .get<BoothSamplePack>(`/api/v1/booth_sample_packs/${packParam}`)
      .then((res) => {
        if (res.data.is_owner) setExistingPack(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, [packParam]);

  const many = packMode || existingPack !== null;

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []);
      e.target.value = '';
      const added = picked.map((file) => {
        nextKey.current += 1;
        return {
          key: `file-${nextKey.current}`,
          file,
          title: trackTitleFromFile(file.name),
          seconds: null,
        };
      });
      setFiles((current) =>
        (many ? [...current, ...added] : added).slice(0, PACK_MAX),
      );
      added.forEach((draft) => {
        void readDuration(draft.file).then((seconds) => {
          setFiles((current) =>
            current.map((f) => (f.key === draft.key ? { ...f, seconds } : f)),
          );
          return undefined;
        });
      });
    },
    [many],
  );

  const handleFileTitle = useCallback((key: string, value: string) => {
    setFiles((current) =>
      current.map((f) => (f.key === key ? { ...f, title: value } : f)),
    );
  }, []);
  const handleRemove = useCallback((key: string) => {
    setFiles((current) => current.filter((f) => f.key !== key));
  }, []);
  const handleOne = useCallback(() => {
    setPackMode(false);
    setFiles((current) => current.slice(0, 1));
  }, []);
  const handlePack = useCallback(() => {
    setPackMode(true);
  }, []);
  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handlePackTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPackTitle(e.target.value);
    },
    [],
  );
  const handlePackAbout = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPackAbout(e.target.value);
    },
    [],
  );
  const handleCover = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCover(e.target.files?.[0] ?? null);
  }, []);

  // One file picked: its name starts the title.
  const firstName = files[0]?.title;
  useEffect(() => {
    if (!many && firstName) setTitle((current) => current || firstName);
  }, [many, firstName]);

  const canSubmit =
    files.length > 0 &&
    !files.some(tooLong) &&
    (many
      ? files.every((f) => f.title.trim() !== '') &&
        (existingPack !== null || packTitle.trim() !== '')
      : title.trim() !== '');

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setProgress(0);

    void (async () => {
      try {
        let packId = existingPack?.id ?? null;
        if (packMode && !packId) {
          const coverId = cover ? await uploadMedia(cover) : undefined;
          const res = await api().post<BoothSamplePack>(
            '/api/v1/booth_sample_packs',
            {
              title: packTitle.trim(),
              description: packAbout.trim(),
              cover_id: coverId,
            },
          );
          packId = res.data.id;
        }

        let last: BoothSample | null = null;
        for (const [index, draft] of files.entries()) {
          setProgress(index);
          const audioId = await uploadMedia(draft.file);
          const res = await api().post<BoothSample>('/api/v1/booth_samples', {
            ...detailsPayload(details),
            audio_id: audioId,
            title: many ? draft.title.trim() : title.trim(),
            duration_seconds: draft.seconds ?? undefined,
            pack_id: packId ?? undefined,
          });
          last = res.data;
        }

        if (packId) onShared(`/hub/booth/packs/${packId}`);
        else if (last) onShared(`/hub/booth/samples/${last.id}`);
      } catch (err) {
        const reason = (err as { response?: { data?: { error?: string } } })
          .response?.data?.error;
        setError(
          reason
            ? intl.formatMessage(messages.failed, { reason })
            : intl.formatMessage(messages.failedTryAgain),
        );
        setSubmitting(false);
      }
    })();
  }, [
    canSubmit,
    existingPack,
    packMode,
    cover,
    packTitle,
    packAbout,
    files,
    details,
    many,
    title,
    onShared,
    intl,
  ]);

  return (
    <ComposeShell
      korner='booth'
      label={intl.formatMessage(messages.shellLabel)}
      switcher={<ComposerSwitch mode='sample' />}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.submitting, {
        number: progress + 1,
        count: files.length,
      })}
      submitting={submitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      {error && <ComposeHint error>{error}</ComposeHint>}

      {existingPack ? (
        <ComposeHint>
          {intl.formatMessage(messages.addingTo, { pack: existingPack.title })}
        </ComposeHint>
      ) : (
        <div className='booth-upload-form__field'>
          <span>{intl.formatMessage(messages.shape)}</span>
          <div className='booth-upload-form__shape'>
            <KornerPill
              label={intl.formatMessage(messages.one)}
              active={!packMode}
              onClick={handleOne}
              disabled={submitting}
            />
            <KornerPill
              label={intl.formatMessage(messages.pack)}
              active={packMode}
              onClick={handlePack}
              disabled={submitting}
            />
          </div>
        </div>
      )}

      {packMode && !existingPack && (
        <>
          <ComposeTitle
            value={packTitle}
            onChange={handlePackTitle}
            placeholder={intl.formatMessage(messages.packTitle)}
            aria-label={intl.formatMessage(messages.packTitle)}
            maxLength={200}
            disabled={submitting}
          />
          <ComposeBody
            value={packAbout}
            onChange={handlePackAbout}
            placeholder={intl.formatMessage(messages.packAbout)}
            aria-label={intl.formatMessage(messages.packAbout)}
            rows={2}
            maxLength={5000}
            disabled={submitting}
          />
          <div className='booth-upload-form__field'>
            <span>{intl.formatMessage(messages.cover)}</span>
            <label className='booth-upload-form__file-picker'>
              <input
                type='file'
                accept='image/*'
                onChange={handleCover}
                disabled={submitting}
              />
              <span className='booth-upload-form__file-picker-label'>
                {intl.formatMessage(
                  cover ? messages.replace : messages.pickCover,
                )}
              </span>
            </label>
            {cover && (
              <span className='booth-upload-form__file-info'>{cover.name}</span>
            )}
          </div>
        </>
      )}

      {/* A file picker, not a kit field: the picker is its own <label>. */}
      <div className='booth-upload-form__field booth-album-field'>
        <span>
          {intl.formatMessage(many ? messages.files : messages.file)} *
        </span>
        {files.length > 0 && (many || files.some(tooLong)) && (
          <ol className='booth-album-field__list'>
            {files.map((draft, i) => (
              <FileRow
                key={draft.key}
                draft={draft}
                index={i}
                disabled={submitting}
                onTitle={handleFileTitle}
                onRemove={handleRemove}
              />
            ))}
          </ol>
        )}
        {!many && files[0] && !tooLong(files[0]) && (
          <span className='booth-upload-form__file-info'>
            {files[0].file.name} · {formatDuration(files[0].seconds)}
          </span>
        )}
        {(many ? files.length < PACK_MAX : true) && (
          <label className='booth-upload-form__file-picker'>
            <input
              type='file'
              accept='audio/*'
              multiple={many}
              onChange={handleFiles}
              disabled={submitting}
            />
            <span className='booth-upload-form__file-picker-label'>
              {intl.formatMessage(
                !many
                  ? files.length > 0
                    ? messages.replace
                    : messages.pickOne
                  : files.length > 0
                    ? messages.pickMore
                    : messages.pickMany,
              )}
            </span>
          </label>
        )}
        <small className='booth-upload-form__hint'>
          {intl.formatMessage(messages.fileHint)}
        </small>
      </div>

      {!many && (
        <ComposeTitle
          value={title}
          onChange={handleTitle}
          placeholder={intl.formatMessage(messages.title)}
          aria-label={intl.formatMessage(messages.title)}
          maxLength={200}
          disabled={submitting}
        />
      )}

      {many && (
        <ComposeHint>{intl.formatMessage(messages.packDetails)}</ComposeHint>
      )}
      <SampleFields
        value={details}
        onChange={setDetails}
        disabled={submitting}
      />
    </ComposeShell>
  );
};
