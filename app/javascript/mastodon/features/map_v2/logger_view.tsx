import { useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiCreateTrek } from 'mastodon/api/map_treks';
import type { TrekActivity } from 'mastodon/api/map_treks';
import { Button } from 'mastodon/components/button';

import { parseTrackFile } from './gpx';
import type { ParsedTrack } from './gpx';

// Map — Logger lens. Records a trek by hand (activity + numbers) or by
// importing a GPS file (GPX/TCX). The file is parsed in the browser and only
// [lng,lat] points plus the derived distance/time/climb are sent — any
// heart-rate / cadence / power / device fields are never read. The new trek
// starts as a private draft; it's published to Mates from the Treks lens.

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
  run: { id: 'map.activity.run', defaultMessage: 'Run' },
  walk: { id: 'map.activity.walk', defaultMessage: 'Walk' },
  hike: { id: 'map.activity.hike', defaultMessage: 'Hike' },
  swim: { id: 'map.activity.swim', defaultMessage: 'Swim' },
  ride: { id: 'map.activity.ride', defaultMessage: 'Ride' },
  paddle: { id: 'map.activity.paddle', defaultMessage: 'Paddle' },
});

export const LoggerView: React.FC = () => {
  const intl = useIntl();
  const [activity, setActivity] = useState<TrekActivity>('run');
  const [title, setTitle] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [parsed, setParsed] = useState<ParsedTrack | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);

  const onActivity = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivity(e.currentTarget.value as TrekActivity);
  }, []);
  const onTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.currentTarget.value);
  }, []);
  const onDistance = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDistanceKm(e.currentTarget.value);
  }, []);
  const onTime = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeMin(e.currentTarget.value);
  }, []);

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
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
        setError(err instanceof Error ? err.message : 'Could not read that file.');
      });
  }, []);

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
          setSavedTitle(trek.title);
          setActivity('run');
          setTitle('');
          setDistanceKm('');
          setTimeMin('');
          setParsed(null);
          setFileName(null);
        })
        .catch(() => {
          setError('Could not log that trek. Try again.');
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [activity, title, distanceKm, timeMin, parsed],
  );

  return (
    <div className='map-logger'>
      {savedTitle && (
        <div className='map-logger__saved' role='status'>
          <FormattedMessage
            id='map.logger.saved'
            defaultMessage='Logged “{title}” as a private draft.'
            values={{ title: savedTitle }}
          />{' '}
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

        <div className='map-logger__import'>
          <label className='map-logger__file'>
            <FormattedMessage
              id='map.logger.import'
              defaultMessage='Import a GPS file (GPX or TCX)'
            />
            <input type='file' accept='.gpx,.tcx,application/gpx+xml' onChange={onFile} />
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
                <FormattedMessage id='map.logger.clear' defaultMessage='clear' />
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

        {error && <p className='map-logger__error'>{error}</p>}

        <Button type='submit' disabled={saving}>
          {intl.formatMessage(saving ? messages.saving : messages.save)}
        </Button>
      </form>
    </div>
  );
};
