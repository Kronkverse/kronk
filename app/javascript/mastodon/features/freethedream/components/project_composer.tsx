import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdCreateProject,
  apiFtdUpdateProject,
  apiFtdUploadCover,
} from 'mastodon/api/freethedream';
import type {
  FtdCover,
  FtdJoining,
  FtdProject,
} from 'mastodon/api_types/freethedream';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { errorOf, parseLine } from './shared';

const messages = defineMessages({
  newProject: {
    id: 'freethedream.compose.seed',
    defaultMessage: 'Seed an emergence',
  },
  newPart: {
    id: 'freethedream.compose.gang',
    defaultMessage: 'Coalesce a gang',
  },
  editProject: {
    id: 'freethedream.compose.edit_project',
    defaultMessage: 'Edit',
  },
  partSubtitle: {
    id: 'freethedream.compose.gang_subtitle',
    defaultMessage: 'In {title}',
  },
  projectSubtitle: {
    id: 'freethedream.compose.project_subtitle',
    defaultMessage: 'You run it. People who join can add to it.',
  },
  start: { id: 'freethedream.compose.seed_submit', defaultMessage: 'Seed' },
  add: { id: 'freethedream.compose.add', defaultMessage: 'Add' },
  save: { id: 'freethedream.compose.save', defaultMessage: 'Save' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
  name: { id: 'freethedream.compose.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'freethedream.compose.name_placeholder',
    defaultMessage: 'Mini Doof',
  },
  sectionPlaceholder: {
    id: 'freethedream.compose.gang_placeholder',
    defaultMessage: 'Kitchen, Wash station, Sound',
  },
  cover: { id: 'freethedream.compose.cover', defaultMessage: 'Cover photo' },
  coverAdd: {
    id: 'freethedream.compose.cover_add',
    defaultMessage: 'Choose a photo',
  },
  coverChange: {
    id: 'freethedream.compose.cover_change',
    defaultMessage: 'Change',
  },
  coverRemove: {
    id: 'freethedream.compose.cover_remove',
    defaultMessage: 'Remove',
  },
  uploading: {
    id: 'freethedream.compose.uploading',
    defaultMessage: 'Uploading…',
  },
  about: {
    id: 'freethedream.compose.about',
    defaultMessage: "What it's about",
  },
  ends: { id: 'freethedream.compose.ends', defaultMessage: 'Date (optional)' },
  groupsInside: {
    id: 'freethedream.compose.gangs_inside',
    defaultMessage: 'Gangs to start with (optional)',
  },
  fractalsInside: {
    id: 'freethedream.compose.fractals_inside',
    defaultMessage: 'Fractals to start with (optional)',
  },
  fractalsPlaceholder: {
    id: 'freethedream.compose.fractals_placeholder',
    defaultMessage: 'Cooking, Cleaning, Storage, Logistics',
  },
  newFractal: {
    id: 'freethedream.compose.fractal',
    defaultMessage: 'Add a fractal',
  },
  groupsPlaceholder: {
    id: 'freethedream.compose.groups_placeholder',
    defaultMessage: 'Kitchen, Sound, Site, Welcome',
  },
  sectionsHint: {
    id: 'freethedream.compose.sections_hint',
    defaultMessage: 'Separate them with commas or put one on each line.',
  },
  gear: {
    id: 'freethedream.compose.gear',
    defaultMessage: 'What all of it needs (optional)',
  },
  gearPlaceholder: {
    id: 'freethedream.compose.gear_placeholder',
    defaultMessage: 'Power\nLighting\n200 L water\n4 tarps',
  },
  gearHint: {
    id: 'freethedream.compose.gear_hint',
    defaultMessage:
      'One on each line. Gear that only one gang needs goes in that gang.',
  },
  joining: {
    id: 'freethedream.compose.joining',
    defaultMessage: 'Who can join',
  },
  open: { id: 'freethedream.joining.open', defaultMessage: 'Anyone' },
  openHint: {
    id: 'freethedream.joining.open_hint',
    defaultMessage: 'They join with one tap.',
  },
  byRequest: {
    id: 'freethedream.joining.by_request',
    defaultMessage: 'By request',
  },
  byRequestHint: {
    id: 'freethedream.joining.by_request_hint',
    defaultMessage: 'They ask, and you accept.',
  },
});

interface Props {
  // Editing this project or part, or adding a part inside `parent`, or
  // (neither) starting a new project.
  editing?: FtdProject;
  parent?: { id: string; title: string; level: FtdProject['level'] };
  onCancel: () => void;
  onSaved: (project: FtdProject) => void;
}

export const ProjectComposer: React.FC<Props> = ({
  editing,
  parent,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [endsOn, setEndsOn] = useState(editing?.ends_on ?? '');
  const [cover, setCover] = useState<FtdCover | null>(editing?.cover ?? null);
  const [uploading, setUploading] = useState(false);
  const [joining, setJoining] = useState<FtdJoining>(
    editing?.joining ?? 'open',
  );
  const [sections, setSections] = useState('');
  const [gear, setGear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top = editing ? editing.top : !parent;
  // Adding inside an emergence makes a gang; inside a gang, a fractal.
  const fractal = parent?.level === 'gang';

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleSections = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSections(e.target.value);
    },
    [],
  );
  const handleGear = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setGear(e.target.value);
    },
    [],
  );
  const handleEnds = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndsOn(e.target.value);
  }, []);
  const handleCoverFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(true);
      setError(null);
      apiFtdUploadCover(file)
        .then((media) => {
          setCover(media);
          setUploading(false);
        })
        .catch((err: unknown) => {
          setError(errorOf(err));
          setUploading(false);
        });
    },
    [],
  );
  const handleCoverRemove = useCallback(() => {
    setCover(null);
  }, []);
  const handleJoining = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setJoining(e.target.value === 'by_request' ? 'by_request' : 'open');
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    setBusy(true);
    setError(null);
    const params = {
      title: title.trim(),
      description: description.trim(),
      ...(top
        ? {
            ends_on: endsOn || null,
            joining,
            cover_media_attachment_id: cover?.id ?? null,
          }
        : {}),
    };
    const request = editing
      ? apiFtdUpdateProject(editing.id, params)
      : apiFtdCreateProject(
          { ...params, parent_id: parent?.id },
          {
            sections: (fractal ? '' : sections)
              .split(/[\n,]/)
              .map((name) => name.trim())
              .filter(Boolean),
            needs: gear
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map(parseLine)
              .filter((need) => need.title),
          },
        );
    request.then(onSaved).catch((err: unknown) => {
      setError(errorOf(err));
      setBusy(false);
    });
  }, [
    title,
    description,
    endsOn,
    cover,
    fractal,
    joining,
    sections,
    gear,
    top,
    editing,
    parent,
    onSaved,
  ]);

  const label = intl.formatMessage(
    editing
      ? messages.editProject
      : fractal
        ? messages.newFractal
        : parent
          ? messages.newPart
          : messages.newProject,
  );
  const subtitle = editing
    ? undefined
    : parent
      ? intl.formatMessage(messages.partSubtitle, { title: parent.title })
      : intl.formatMessage(messages.projectSubtitle);

  return (
    <ComposeShell
      korner='freethedream'
      label={label}
      subtitle={subtitle}
      submitLabel={intl.formatMessage(
        editing ? messages.save : parent ? messages.add : messages.start,
      )}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={busy}
      canSubmit={title.trim().length > 0 && !uploading}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <div className='freethedream-form'>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.name)}
          </span>
          <input
            className='freethedream__input'
            value={title}
            onChange={handleTitle}
            maxLength={120}
            placeholder={intl.formatMessage(
              top ? messages.namePlaceholder : messages.sectionPlaceholder,
            )}
          />
        </label>
        <label className='freethedream-form__field'>
          <span className='freethedream-form__label'>
            {intl.formatMessage(messages.about)}
          </span>
          <textarea
            className='freethedream__input'
            rows={4}
            value={description}
            onChange={handleDescription}
            maxLength={5000}
          />
        </label>
        {top && (
          <div className='freethedream-form__field'>
            <span className='freethedream-form__label'>
              {intl.formatMessage(messages.cover)}
            </span>
            {cover && (
              <img
                className='freethedream-form__cover'
                src={cover.preview_url}
                alt=''
              />
            )}
            <div className='freethedream-form__row'>
              <label className='freethedream__link'>
                {intl.formatMessage(
                  uploading
                    ? messages.uploading
                    : cover
                      ? messages.coverChange
                      : messages.coverAdd,
                )}
                <input
                  type='file'
                  accept='image/*'
                  className='freethedream-form__file'
                  onChange={handleCoverFile}
                  disabled={uploading}
                />
              </label>
              {cover && !uploading && (
                <button
                  type='button'
                  className='freethedream__link'
                  onClick={handleCoverRemove}
                >
                  {intl.formatMessage(messages.coverRemove)}
                </button>
              )}
            </div>
          </div>
        )}
        {top && (
          <label className='freethedream-form__field'>
            <span className='freethedream-form__label'>
              {intl.formatMessage(messages.ends)}
            </span>
            <input
              type='date'
              className='freethedream__input'
              value={endsOn}
              onChange={handleEnds}
            />
          </label>
        )}
        {!editing && (
          <>
            {/* An emergence starts with its gangs, a gang with its fractals;
                a fractal holds nothing (Tal, 2026-10-15). */}
            {!fractal && (
              <label className='freethedream-form__field'>
                <span className='freethedream-form__label'>
                  {intl.formatMessage(
                    top ? messages.groupsInside : messages.fractalsInside,
                  )}
                </span>
                <textarea
                  className='freethedream__input'
                  rows={2}
                  value={sections}
                  onChange={handleSections}
                  placeholder={intl.formatMessage(
                    top
                      ? messages.groupsPlaceholder
                      : messages.fractalsPlaceholder,
                  )}
                />
                <span className='freethedream-form__hint'>
                  {intl.formatMessage(messages.sectionsHint)}
                </span>
              </label>
            )}
            <label className='freethedream-form__field'>
              <span className='freethedream-form__label'>
                {intl.formatMessage(messages.gear)}
              </span>
              <textarea
                className='freethedream__input'
                rows={4}
                value={gear}
                onChange={handleGear}
                placeholder={intl.formatMessage(messages.gearPlaceholder)}
              />
              <span className='freethedream-form__hint'>
                {intl.formatMessage(messages.gearHint)}
              </span>
            </label>
          </>
        )}
        {top && (
          <fieldset className='freethedream-form__field'>
            <legend className='freethedream-form__label'>
              {intl.formatMessage(messages.joining)}
            </legend>
            <label className='freethedream-form__choice'>
              <input
                type='radio'
                name='joining'
                value='open'
                checked={joining === 'open'}
                onChange={handleJoining}
              />
              <span>
                <strong>{intl.formatMessage(messages.open)}</strong>{' '}
                {intl.formatMessage(messages.openHint)}
              </span>
            </label>
            <label className='freethedream-form__choice'>
              <input
                type='radio'
                name='joining'
                value='by_request'
                checked={joining === 'by_request'}
                onChange={handleJoining}
              />
              <span>
                <strong>{intl.formatMessage(messages.byRequest)}</strong>{' '}
                {intl.formatMessage(messages.byRequestHint)}
              </span>
            </label>
          </fieldset>
        )}
        {error && (
          <p className='freethedream__error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
