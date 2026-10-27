import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import {
  apiAddSeriesChapter,
  apiDeleteSeries,
  apiListMyChronicles,
  apiUpdateSeries,
  apiUploadChroniclePicture,
} from 'mastodon/api/kronikles';
import type {
  ApiChronicleJSON,
  ApiChronicleSeriesJSON,
  ChronicleSummaryJSON,
} from 'mastodon/api_types/kronikles';
import {
  ComposeField,
  ComposeHint,
  ComposeSelect,
  ComposeTextarea,
  ComposeTitle,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { PhotoDropZone } from 'mastodon/components/media';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

// The two small forms on a Series page (docs/spaces/kronikles.md, Series),
// both in the shared compose shell. Neither makes a new record to Konnect:
// a Series isn't Konnectable on its own (its chapters are), and adding a
// chapter changes one that exists.

const messages = defineMessages({
  editHeading: {
    id: 'kronikles.series.edit_heading',
    defaultMessage: 'Edit Series',
  },
  save: { id: 'kronikles.composer.save', defaultMessage: 'Save' },
  saving: { id: 'kronikles.composer.saving', defaultMessage: 'Saving…' },
  titlePlaceholder: {
    id: 'kronikles.series.title_placeholder',
    defaultMessage: 'Series title',
  },
  description: {
    id: 'kronikles.series.description_label',
    defaultMessage: 'About this Series',
  },
  descriptionHint: {
    id: 'kronikles.series.description_hint',
    defaultMessage: 'Optional. Shown at the top of its contents.',
  },
  cover: { id: 'kronikles.series.cover_label', defaultMessage: 'Cover' },
  coverPick: {
    id: 'kronikles.series.cover_pick',
    defaultMessage: 'Drag a picture here, or click to choose',
  },
  coverUploading: {
    id: 'kronikles.composer.picture_uploading',
    defaultMessage: 'Uploading…',
  },
  coverFailed: {
    id: 'kronikles.composer.picture_failed',
    defaultMessage: 'That picture didn’t upload. Try again.',
  },
  coverRemove: {
    id: 'kronikles.series.cover_remove',
    defaultMessage: 'Remove cover',
  },
  coverReady: {
    id: 'kronikles.series.cover_ready',
    defaultMessage: 'Picture uploaded. Save to use it.',
  },
  saveFailed: {
    id: 'kronikles.series.save_failed',
    defaultMessage: 'Could not save this Series.',
  },
  deleteSeries: {
    id: 'kronikles.series.delete',
    defaultMessage: 'Delete Series',
  },
  deleteConfirm: {
    id: 'kronikles.series.delete_confirm',
    defaultMessage:
      'Delete this Series? Its Kronikles stay, just not in a Series.',
  },
  addHeading: {
    id: 'kronikles.series.add_chapter',
    defaultMessage: 'Add a chapter',
  },
  add: { id: 'kronikles.series.add', defaultMessage: 'Add' },
  adding: { id: 'kronikles.series.adding', defaultMessage: 'Adding…' },
  kronikleLabel: {
    id: 'kronikles.series.kronikle_label',
    defaultMessage: 'Kronikle',
  },
  pickOne: {
    id: 'kronikles.series.pick_one',
    defaultMessage: 'Choose one of your Kronikles',
  },
  loading: { id: 'kronikles.loading', defaultMessage: 'Loading…' },
  noneLeft: {
    id: 'kronikles.series.none_left',
    defaultMessage:
      'All your Kronikles are in this Series already. Write a new one and choose this Series as you do.',
  },
  addHint: {
    id: 'kronikles.series.add_hint',
    defaultMessage: 'It goes in as the last chapter.',
  },
  movesFrom: {
    id: 'kronikles.series.moves_from',
    defaultMessage: 'It goes in as the last chapter, and leaves {title}.',
  },
  addFailed: {
    id: 'kronikles.series.add_failed',
    defaultMessage: 'Could not add that chapter.',
  },
});

interface SeriesComposerProps {
  series: ApiChronicleSeriesJSON;
  onCancel: () => void;
  onSaved: (series: ApiChronicleSeriesJSON) => void;
}

// Edit a Series: its title, description and cover, and Delete at the foot.
export const SeriesComposer: React.FC<SeriesComposerProps> = ({
  series,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description);
  const [coverId, setCoverId] = useState<string | null>(
    series.cover_id ?? null,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(
    series.cover_url,
  );
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      void apiUploadChroniclePicture(file)
        .then((media) => {
          setCoverId(media.id);
          setCoverPreview(media.preview_url);
          return undefined;
        })
        .catch(() => {
          setError(intl.formatMessage(messages.coverFailed));
        })
        .finally(() => {
          setUploading(false);
        });
    },
    [intl],
  );

  const handleRemoveCover = useCallback(() => {
    setCoverId(null);
    setCoverPreview(null);
  }, []);

  const canSubmit = title.trim().length > 0 && !pending && !uploading;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        onSaved(
          await apiUpdateSeries(series.id, {
            title: title.trim(),
            description: description.trim(),
            cover_media_attachment_id: coverId,
          }),
        );
      } catch {
        setPending(false);
        setError(intl.formatMessage(messages.saveFailed));
      }
    })();
  }, [canSubmit, coverId, description, intl, onSaved, series.id, title]);

  const handleDelete = useCallback(() => {
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setPending(true);
      void (async () => {
        try {
          await apiDeleteSeries(series.id);
          history.replace('/hub/kronikles');
        } catch {
          setPending(false);
          setError(intl.formatMessage(messages.saveFailed));
        }
      })();
    });
  }, [confirmThen, history, intl, series.id]);

  const coverChanged = coverId !== (series.cover_id ?? null);

  return (
    <ComposeShell
      korner='kronikles'
      label={intl.formatMessage(messages.editHeading)}
      onCancel={onCancel}
      onSubmit={submit}
      konnect={null}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={pending}
      canSubmit={canSubmit}
    >
      {confirmDialog}
      <ComposeTitle
        value={title}
        onChange={handleTitleChange}
        placeholder={intl.formatMessage(messages.titlePlaceholder)}
        maxLength={240}
        disabled={pending}
      />

      <ComposeField
        label={intl.formatMessage(messages.description)}
        hint={intl.formatMessage(messages.descriptionHint)}
      >
        <ComposeTextarea
          value={description}
          onChange={handleDescriptionChange}
          maxLength={2000}
          rows={4}
          disabled={pending}
        />
      </ComposeField>

      <ComposeField label={intl.formatMessage(messages.cover)}>
        {coverPreview && (
          <img
            className='kronikles-series__cover-preview'
            src={coverPreview}
            alt=''
          />
        )}
        {coverId && !coverPreview && coverChanged && (
          <ComposeHint>{intl.formatMessage(messages.coverReady)}</ComposeHint>
        )}
        <PhotoDropZone
          onFiles={handleFiles}
          multiple={false}
          disabled={pending || uploading}
          label={intl.formatMessage(
            uploading ? messages.coverUploading : messages.coverPick,
          )}
        />
        {coverId && (
          <button
            type='button'
            className='kronikles-series__cover-remove'
            onClick={handleRemoveCover}
            disabled={pending}
          >
            {intl.formatMessage(messages.coverRemove)}
          </button>
        )}
      </ComposeField>

      {error && <ComposeHint error>{error}</ComposeHint>}

      <button
        type='button'
        className='compose-shell__delete'
        onClick={handleDelete}
        disabled={pending}
      >
        {intl.formatMessage(messages.deleteSeries)}
      </button>
    </ComposeShell>
  );
};

interface AddChapterProps {
  seriesId: string;
  onCancel: () => void;
  onAdded: (chapters: ChronicleSummaryJSON[]) => void;
}

// Put one of your Kronikles into this Series, as its last chapter. One in
// another Series moves out of it.
export const AddChapterComposer: React.FC<AddChapterProps> = ({
  seriesId,
  onCancel,
  onAdded,
}) => {
  const intl = useIntl();
  const [mine, setMine] = useState<ApiChronicleJSON[] | null>(null);
  const [picked, setPicked] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const guard = { stale: false };
    void (async () => {
      try {
        const list = await apiListMyChronicles();
        if (!guard.stale) setMine(list);
      } catch {
        if (!guard.stale) setMine([]);
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, []);

  const choices = useMemo(
    () => (mine ?? []).filter((c) => c.series?.id !== seriesId),
    [mine, seriesId],
  );
  const pickedChronicle = choices.find((c) => c.id === picked);

  const handlePickChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setPicked(e.target.value);
    },
    [],
  );

  const canSubmit = picked !== '' && !pending;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        onAdded(await apiAddSeriesChapter(seriesId, picked));
      } catch {
        setPending(false);
        setError(intl.formatMessage(messages.addFailed));
      }
    })();
  }, [canSubmit, intl, onAdded, picked, seriesId]);

  const hint = pickedChronicle?.series
    ? intl.formatMessage(messages.movesFrom, {
        title: pickedChronicle.series.title,
      })
    : intl.formatMessage(messages.addHint);

  return (
    <ComposeShell
      korner='kronikles'
      label={intl.formatMessage(messages.addHeading)}
      onCancel={onCancel}
      onSubmit={submit}
      konnect={null}
      submitLabel={intl.formatMessage(messages.add)}
      submittingLabel={intl.formatMessage(messages.adding)}
      submitting={pending}
      canSubmit={canSubmit}
    >
      {mine === null ? (
        <ComposeHint>{intl.formatMessage(messages.loading)}</ComposeHint>
      ) : choices.length === 0 ? (
        <ComposeHint>{intl.formatMessage(messages.noneLeft)}</ComposeHint>
      ) : (
        <ComposeField
          label={intl.formatMessage(messages.kronikleLabel)}
          hint={hint}
        >
          <ComposeSelect
            value={picked}
            onChange={handlePickChange}
            disabled={pending}
          >
            <option value=''>{intl.formatMessage(messages.pickOne)}</option>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </ComposeSelect>
        </ComposeField>
      )}

      {error && <ComposeHint error>{error}</ComposeHint>}
    </ComposeShell>
  );
};
