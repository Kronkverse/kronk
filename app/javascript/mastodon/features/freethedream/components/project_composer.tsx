import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiFtdCreateProject,
  apiFtdUpdateProject,
} from 'mastodon/api/freethedream';
import type { FtdJoining, FtdProject } from 'mastodon/api_types/freethedream';
import { ComposeShell } from 'mastodon/components/compose_shell';

import { errorOf } from './shared';

const messages = defineMessages({
  newProject: {
    id: 'freethedream.compose.project',
    defaultMessage: 'Start a project',
  },
  newPart: {
    id: 'freethedream.compose.section',
    defaultMessage: 'Add a section',
  },
  editProject: {
    id: 'freethedream.compose.edit_project',
    defaultMessage: 'Edit',
  },
  partSubtitle: {
    id: 'freethedream.compose.section_subtitle',
    defaultMessage: 'Inside {title}. You run it.',
  },
  projectSubtitle: {
    id: 'freethedream.compose.project_subtitle',
    defaultMessage: 'You run it. People who join can add to it.',
  },
  start: { id: 'freethedream.compose.start', defaultMessage: 'Start' },
  add: { id: 'freethedream.compose.add', defaultMessage: 'Add' },
  save: { id: 'freethedream.compose.save', defaultMessage: 'Save' },
  saving: { id: 'freethedream.compose.saving', defaultMessage: 'Saving…' },
  name: { id: 'freethedream.compose.name', defaultMessage: 'Name' },
  namePlaceholder: {
    id: 'freethedream.compose.name_placeholder',
    defaultMessage: 'Mini Doof',
  },
  sectionPlaceholder: {
    id: 'freethedream.compose.section_placeholder',
    defaultMessage: 'Kitchen, Wash station, Dahl for 40',
  },
  starts: { id: 'freethedream.compose.starts', defaultMessage: 'Starts' },
  endsOn: { id: 'freethedream.compose.ends_on', defaultMessage: 'Ends' },
  where: { id: 'freethedream.compose.where', defaultMessage: 'Where' },
  wherePlaceholder: {
    id: 'freethedream.compose.where_placeholder',
    defaultMessage: 'A place, or "Ask for directions"',
  },
  about: {
    id: 'freethedream.compose.about',
    defaultMessage: "What it's about",
  },
  ends: { id: 'freethedream.compose.ends', defaultMessage: 'Date (optional)' },
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
  parent?: { id: string; title: string };
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
  const [startsOn, setStartsOn] = useState(editing?.starts_on ?? '');
  const [endsOn, setEndsOn] = useState(editing?.ends_on ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [joining, setJoining] = useState<FtdJoining>(
    editing?.joining ?? 'open',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const top = editing ? editing.top : !parent;

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleDescription = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );
  const handleStarts = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartsOn(e.target.value);
  }, []);
  const handleEnds = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndsOn(e.target.value);
  }, []);
  const handleLocation = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocation(e.target.value);
    },
    [],
  );
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
      ends_on: endsOn || null,
      ...(top
        ? { joining, starts_on: startsOn || null, location: location.trim() }
        : {}),
    };
    const request = editing
      ? apiFtdUpdateProject(editing.id, params)
      : apiFtdCreateProject({ ...params, parent_id: parent?.id });
    request.then(onSaved).catch((err: unknown) => {
      setError(errorOf(err));
      setBusy(false);
    });
  }, [
    title,
    description,
    startsOn,
    endsOn,
    location,
    joining,
    top,
    editing,
    parent,
    onSaved,
  ]);

  const label = intl.formatMessage(
    editing
      ? messages.editProject
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
      canSubmit={title.trim().length > 0}
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
        {top ? (
          <>
            <div className='freethedream-form__row'>
              <label className='freethedream-form__field'>
                <span className='freethedream-form__label'>
                  {intl.formatMessage(messages.starts)}
                </span>
                <input
                  type='date'
                  className='freethedream__input'
                  value={startsOn}
                  onChange={handleStarts}
                />
              </label>
              <label className='freethedream-form__field'>
                <span className='freethedream-form__label'>
                  {intl.formatMessage(messages.endsOn)}
                </span>
                <input
                  type='date'
                  className='freethedream__input'
                  value={endsOn}
                  onChange={handleEnds}
                />
              </label>
            </div>
            <label className='freethedream-form__field'>
              <span className='freethedream-form__label'>
                {intl.formatMessage(messages.where)}
              </span>
              <input
                className='freethedream__input'
                value={location}
                onChange={handleLocation}
                maxLength={160}
                placeholder={intl.formatMessage(messages.wherePlaceholder)}
              />
            </label>
          </>
        ) : (
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
