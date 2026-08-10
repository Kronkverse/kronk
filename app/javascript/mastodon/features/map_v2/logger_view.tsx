import { useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiCreateTrek, apiPublishTrek } from 'mastodon/api/map_treks';
import type { TrekActivity, TrekReach } from 'mastodon/api/map_treks';
import { Button } from 'mastodon/components/button';
import { ReachDropdown } from 'mastodon/components/reach_dropdown';
import type { ReachValue } from 'mastodon/components/reach_dropdown';

import { parseTrackFile } from './gpx';
import type { ParsedTrack } from './gpx';

// Map — Logger lens. Records a trek by hand (activity + numbers) or by
// importing a GPS file (GPX/TCX). The file is parsed in the browser and only
// [lng,lat] points plus the derived distance/time/climb are sent — any
// heart-rate / cadence / power / device fields are never read.
//
// "Log it" posts the trek to the feed at the chosen reach (Mates by default),
// like composing a post; choosing "Private draft" keeps it unshared (publish
// later from the Treks lens). Either way the route's start/finish are trimmed
// before saving.

// A share target: one of the reach ladder values, or 'draft' (unshared).
type ShareTarget = TrekReach | 'draft';

const ACTIVITIES: TrekActivity[] = [
  'run',
  'walk',
  'hike',
  'swim',
  'ride',
  'paddle',
];

const messages = defineMessages({
  activity: { id: 'map.logger.activity', defaultMessage: 'Activity' },
  title: { id: 'map.logger.title', defaultMessage: 'Title' },
  titlePlaceholder: {
    id: 'map.logger.title_placeholder',
    defaultMessage: 'Morning run',
  },
  distance: { id: 'map.logger.distance', defaultMessage: 'Distance (km)' },
  time: { id: 'map.logger.time', defaultMessage: 'Time (minutes)' },
  save: { id: 'map.logger.save', defaultMessage: 'Log it' },
  saving: { id: 'map.logger.saving', defaultMessage: 'Logging…' },
  post: { id: 'map.logger.post', defaultMessage: 'Post it' },
  saveDraft: { id: 'map.logger.save_draft', defaultMessage: 'Save draft' },
  shareLabel: { id: 'map.logger.share', defaultMessage: 'Post to' },
  reachMates: { id: 'map.treks.reach.mates', defaultMessage: 'Mates' },
  reachPublic: { id: 'map.treks.reach.public', defaultMessage: 'Public' },
  reachOrbit: { id: 'map.treks.reach.orbit', defaultMessage: 'Orbit' },
  reachSelf: { id: 'map.treks.reach.self', defaultMessage: 'Just me' },
  draft: { id: 'map.logger.draft', defaultMessage: 'Private draft' },
  run: { id: 'map.activity.run', defaultMessage: 'Run' },
  walk: { id: 'map.activity.walk', defaultMessage: 'Walk' },
  hike: { id: 'map.activity.hike', defaultMessage: 'Hike' },
  swim: { id: 'map.activity.swim', defaultMessage: 'Swim' },
  ride: { id: 'map.activity.ride', defaultMessage: 'Ride' },
  paddle: { id: 'map.activity.paddle', defaultMessage: 'Paddle' },
});

// Where "Log it" sends the trek. Mates is the default reach (§2.4); 'draft'
// keeps it unshared. `label` keys into `messages` (React Intl static ids).
const SHARE_OPTIONS: { value: ShareTarget; label: keyof typeof messages }[] = [
  { value: 'mates', label: 'reachMates' },
  { value: 'public', label: 'reachPublic' },
  { value: 'orbit', label: 'reachOrbit' },
  { value: 'self_only', label: 'reachSelf' },
  { value: 'draft', label: 'draft' },
];

const shareLabelKey = (value: ShareTarget): keyof typeof messages =>
  SHARE_OPTIONS.find((o) => o.value === value)?.label ?? 'reachMates';

export const LoggerView: React.FC = () => {
  const intl = useIntl();
  const [activity, setActivity] = useState<TrekActivity>('run');
  const [title, setTitle] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reach + a separate "save as draft" toggle (draft keeps the trek unshared).
  // Standard ReachDropdown for the reach; krew is hidden (TrekReach has none).
  const [reach, setReach] = useState<TrekReach>('mates');
  const [isDraft, setIsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [savedShare, setSavedShare] = useState<ShareTarget>('mates');
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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const clearFile = useCallback(() => {
    setParsed(null);
    setFileName(null);
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) {
        setError('Give your trek a title.');
        return;
      }
      const distance_m = parsed
        ? parsed.distance_m
        : Math.round(parseFloat(distanceKm) * 1000);
      if (!parsed && !(distance_m > 0)) {
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
        distance_m,
        moving_sec,
        elevation_gain: parsed?.elevation_gain ?? undefined,
      })
        .then((trek) => {
          // Draft keeps it unshared; otherwise publish at the chosen reach.
          const published = isDraft
            ? Promise.resolve()
            : apiPublishTrek(trek.id, reach);
          return published.then(() => {
            setSavedShare(isDraft ? 'draft' : reach);
            setSavedTitle(trek.title);
            setActivity('run');
            setTitle('');
            setDistanceKm('');
            setTimeMin('');
            setParsed(null);
            setFileName(null);
          });
        })
        .catch(() => {
          setError('Could not log that trek. Try again.');
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [activity, title, distanceKm, timeMin, parsed, reach, isDraft],
  );

  return (
    <div className='map-logger'>
      {savedTitle && (
        <div className='map-logger__saved' role='status'>
          {savedShare === 'draft' ? (
            <FormattedMessage
              id='map.logger.saved'
              defaultMessage='Logged “{title}” as a private draft.'
              values={{ title: savedTitle }}
            />
          ) : (
            <FormattedMessage
              id='map.logger.posted'
              defaultMessage='Posted “{title}” to your feed · {reach}.'
              values={{
                title: savedTitle,
                reach: intl.formatMessage(messages[shareLabelKey(savedShare)]),
              }}
            />
          )}{' '}
          <Link to='/hub/map/treks'>
            <FormattedMessage
              id='map.logger.view_treks'
              defaultMessage='View in Treks'
            />
          </Link>
        </div>
      )}

      <form className='map-logger__form' onSubmit={submit}>
        <label className='map-logger__field'>
          <span>{intl.formatMessage(messages.activity)}</span>
          <select value={activity} onChange={onActivity}>
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {intl.formatMessage(messages[a])}
              </option>
            ))}
          </select>
        </label>

        <label className='map-logger__field'>
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
          className={`map-logger__import${dragging ? ' is-dragging' : ''}`}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <label className='map-logger__file'>
            <span className='map-logger__file-cta'>
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
          <p className='map-logger__hint'>
            <FormattedMessage
              id='map.logger.import_hint'
              defaultMessage='Read on your device — only the route and distance are sent, never heart-rate or device data. The start and finish are trimmed before saving.'
            />
          </p>
          {parsed && fileName && (
            <p className='map-logger__parsed'>
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

        <div className='map-logger__row'>
          <label className='map-logger__field'>
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
          <label className='map-logger__field'>
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

        <div className='map-logger__field'>
          <span>{intl.formatMessage(messages.shareLabel)}</span>
          <ReachDropdown
            value={reach}
            onChange={onReach}
            hide={['krew']}
            disabled={isDraft}
          />
        </div>

        <label className='map-logger__draft'>
          <input type='checkbox' checked={isDraft} onChange={onDraftToggle} />
          <span>{intl.formatMessage(messages.draft)}</span>
        </label>

        {error && <p className='map-logger__error'>{error}</p>}

        <Button type='submit' disabled={saving}>
          {intl.formatMessage(
            saving
              ? messages.saving
              : isDraft
                ? messages.saveDraft
                : messages.post,
          )}
        </Button>
      </form>
    </div>
  );
};
