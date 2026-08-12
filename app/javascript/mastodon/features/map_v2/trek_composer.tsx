import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { apiCreateTrek, apiPublishTrek } from 'mastodon/api/map_treks';
import type {
  ApiTrekJSON,
  TrekActivity,
  TrekReach,
} from 'mastodon/api/map_treks';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import { parseTrackFile } from './gpx';
import type { ParsedTrack } from './gpx';

// Map — trek composer. Records a trek by hand (activity + numbers) or
// by importing a GPS file (GPX/TCX). The file is parsed in the browser
// and only [lng,lat] points plus the derived distance/time/climb are
// sent — heart-rate / cadence / power / device fields are never read.
//
// Was the full-page LoggerView at /hub/map/logger until 2026-08-12.
// Now the standard `<ComposeShell>` at /hub/map/composer (with
// /hub/map/logger preserved as a legacy alias), matching the pilot
// Albutts + Moments composers — one place across the site (per
// docs/rebuild/decisions.md).

const ACTIVITIES: TrekActivity[] = [
  'run',
  'walk',
  'hike',
  'swim',
  'ride',
  'paddle',
];

const messages = defineMessages({
  // Shell chrome
  label: { id: 'map.logger.composer_label', defaultMessage: 'Log a trek' },
  // Field labels reuse the original `map.logger.*` id space so any
  // pre-existing translations survive the surface swap.
  activity: { id: 'map.logger.activity', defaultMessage: 'Activity' },
  title: { id: 'map.logger.title', defaultMessage: 'Title' },
  titlePlaceholder: {
    id: 'map.logger.title_placeholder',
    defaultMessage: 'Morning run',
  },
  distance: { id: 'map.logger.distance', defaultMessage: 'Distance (km)' },
  time: { id: 'map.logger.time', defaultMessage: 'Time (minutes)' },
  saving: { id: 'map.logger.saving', defaultMessage: 'Logging…' },
  post: { id: 'map.logger.post', defaultMessage: 'Post it' },
  saveDraft: { id: 'map.logger.save_draft', defaultMessage: 'Save draft' },
  draft: { id: 'map.logger.draft', defaultMessage: 'Private draft' },
  run: { id: 'map.activity.run', defaultMessage: 'Run' },
  walk: { id: 'map.activity.walk', defaultMessage: 'Walk' },
  hike: { id: 'map.activity.hike', defaultMessage: 'Hike' },
  swim: { id: 'map.activity.swim', defaultMessage: 'Swim' },
  ride: { id: 'map.activity.ride', defaultMessage: 'Ride' },
  paddle: { id: 'map.activity.paddle', defaultMessage: 'Paddle' },
});

interface Props {
  onCancel: () => void;
  // Fires after a successful create (+ publish, if not draft). Parent
  // decides where to navigate — MapV2 sends the caller to My treks
  // where the freshly-logged trek shows up.
  onCreated: (trek: ApiTrekJSON) => void;
}

export const TrekComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
  const [activity, setActivity] = useState<TrekActivity>('run');
  const [title, setTitle] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reach + a separate "save as draft" toggle. Reach lives in the
  // shell's `headerAction` slot (same treatment Moments uses); the
  // draft checkbox stays in the body since it's the "publish or not"
  // switch, orthogonal to who-can-see.
  const [reach, setReach] = useState<TrekReach>('mates');
  const [isDraft, setIsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onActivity = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivity(e.currentTarget.value as TrekActivity);
  }, []);
  const onReach = useCallback((value: ReachValue) => {
    setReach(value as TrekReach);
  }, []);
  const onDraftToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsDraft(e.currentTarget.checked);
    },
    [],
  );
  const onTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.currentTarget.value);
  }, []);
  const onDistance = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDistanceKm(e.currentTarget.value);
  }, []);
  const onTime = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeMin(e.currentTarget.value);
  }, []);

  const handleFile = useCallback((file: File | undefined) => {
    setError(null);
    if (!file) {
      setParsed(null);
      setFileName(null);
      return;
    }
    void file
      .text()
      .then((text) => {
        const track = parseTrackFile(text, file.name);
        setParsed(track);
        setFileName(file.name);
        setDistanceKm((track.distance_m / 1000).toFixed(2));
        setTimeMin(Math.round(track.moving_sec / 60).toString());
      })
      .catch((err: unknown) => {
        setParsed(null);
        setFileName(null);
        setError(
          err instanceof Error ? err.message : 'Could not read that file.',
        );
      });
  }, []);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.currentTarget.files?.[0]);
    },
    [handleFile],
  );

  // Stop the drop from bubbling to Mastodon's window-level file-drop
  // handler in features/ui/index.jsx, which otherwise fires
  // `uploadCompose(files)` on the GPX and 422s ("File has contents
  // that are not what they are reported to be" — Paperclip spoof
  // detection). Native handlers on `document` aren't inside the React
  // tree, so a plain `e.stopPropagation()` isn't enough — the
  // underlying event needs `stopImmediatePropagation` too.
  const stopFromWindow = (e: React.DragEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    stopFromWindow(e);
    setDragging(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    stopFromWindow(e);
    setDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    stopFromWindow(e);
    setDragging(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      stopFromWindow(e);
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const clearFile = useCallback(() => {
    setParsed(null);
    setFileName(null);
  }, []);

  // A trek is submittable once it has a title AND either a parsed GPS
  // track (which supplies distance) OR a hand-entered distance > 0.
  // Time is optional (0 renders as "—").
  const distanceMeters = parsed
    ? parsed.distance_m
    : Math.round(parseFloat(distanceKm) * 1000) || 0;
  const canSubmit = title.trim().length > 0 && distanceMeters > 0;

  const submit = useCallback(() => {
    if (!title.trim()) {
      setError('Give your trek a title.');
      return;
    }
    if (distanceMeters <= 0) {
      setError('Enter a distance, or import a GPS file.');
      return;
    }
    const moving_sec = parsed
      ? parsed.moving_sec
      : Math.round((parseFloat(timeMin) || 0) * 60);

    setSaving(true);
    setError(null);
    void apiCreateTrek({
      activity_type: activity,
      title: title.trim(),
      points: parsed?.points,
      distance_m: distanceMeters,
      moving_sec,
      elevation_gain: parsed?.elevation_gain ?? undefined,
    })
      .then((trek) => {
        // Draft keeps it unshared; otherwise publish at the chosen reach.
        const finish = isDraft
          ? Promise.resolve(trek)
          : apiPublishTrek(trek.id, reach).then(() => trek);
        return finish.then(onCreated);
      })
      .catch(() => {
        setError('Could not log that trek. Try again.');
        setSaving(false);
      });
    // Note: on success, the parent unmounts us — no need to reset
    // state or clear `saving` here.
  }, [
    activity,
    title,
    distanceMeters,
    timeMin,
    parsed,
    reach,
    isDraft,
    onCreated,
  ]);

  // ReachDropdown lives in the shell header (matches Moments) so it
  // reads as chrome, not a body field. Hidden when the trek is being
  // saved as a draft — reach is meaningless without a publish.
  const reachControl = !isDraft ? (
    <ReachDropdown value={reach} onChange={onReach} disabled={saving} />
  ) : undefined;

  return (
    <ComposeShell
      korner='map'
      label={intl.formatMessage(messages.label)}
      submitLabel={intl.formatMessage(
        isDraft ? messages.saveDraft : messages.post,
      )}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={saving}
      canSubmit={canSubmit}
      onSubmit={submit}
      onCancel={onCancel}
      headerAction={reachControl}
    >
      <div className='trek-composer'>
        <label className='trek-composer__field'>
          <span>{intl.formatMessage(messages.activity)}</span>
          <select value={activity} onChange={onActivity}>
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {intl.formatMessage(messages[a])}
              </option>
            ))}
          </select>
        </label>

        <label className='trek-composer__field'>
          <span>{intl.formatMessage(messages.title)}</span>
          <input
            type='text'
            value={title}
            onChange={onTitle}
            placeholder={intl.formatMessage(messages.titlePlaceholder)}
            maxLength={120}
          />
        </label>

        <div
          className={`trek-composer__import${dragging ? ' is-dragging' : ''}`}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <label className='trek-composer__file'>
            <span className='trek-composer__file-cta'>
              <FormattedMessage
                id='map.logger.import'
                defaultMessage='Drag a GPS file here, or choose one (GPX or TCX)'
              />
            </span>
            <input
              type='file'
              accept='.gpx,.tcx,application/gpx+xml'
              onChange={onFile}
            />
          </label>
          <p className='trek-composer__hint'>
            <FormattedMessage
              id='map.logger.import_hint'
              defaultMessage='Read on your device — only the route and distance are sent, never heart-rate or device data. The start and finish are trimmed before saving.'
            />
          </p>
          {parsed && fileName && (
            <p className='trek-composer__parsed'>
              <FormattedMessage
                id='map.logger.parsed'
                defaultMessage='{file}: {points} points · {km} km'
                values={{
                  file: fileName,
                  points: parsed.points.length,
                  km: (parsed.distance_m / 1000).toFixed(1),
                }}
              />{' '}
              <button type='button' onClick={clearFile}>
                <FormattedMessage
                  id='map.logger.clear'
                  defaultMessage='clear'
                />
              </button>
            </p>
          )}
        </div>

        <div className='trek-composer__row'>
          <label className='trek-composer__field'>
            <span>{intl.formatMessage(messages.distance)}</span>
            <input
              type='number'
              min='0'
              step='0.01'
              value={distanceKm}
              onChange={onDistance}
              disabled={parsed !== null}
            />
          </label>
          <label className='trek-composer__field'>
            <span>{intl.formatMessage(messages.time)}</span>
            <input
              type='number'
              min='0'
              step='1'
              value={timeMin}
              onChange={onTime}
              disabled={parsed !== null}
            />
          </label>
        </div>

        <label className='trek-composer__draft'>
          <input type='checkbox' checked={isDraft} onChange={onDraftToggle} />
          <span>{intl.formatMessage(messages.draft)}</span>
        </label>

        {error && <p className='trek-composer__error'>{error}</p>}
      </div>
    </ComposeShell>
  );
};
