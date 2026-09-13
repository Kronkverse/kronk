/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import { useCallback, useEffect, useState } from 'react';

import { defineMessages, FormattedDate, useIntl } from 'react-intl';

import { apiRequestGet, apiRequestPost } from 'mastodon/api';
import { SettingsSection } from 'mastodon/features/settings/components';

// Native archive section on /settings/data. Replaces the "Download
// your archive" link that used to bounce out to the Rails
// /settings/export page (Tal 2026-09-13 audit).
//
// Wraps /api/v1/settings/backups — GET lists existing backups
// (newest-first), POST creates one (rate-limited server-side to one
// every 6 days via BackupPolicy::MIN_AGE). The button state mirrors
// `can_create_now` so the user isn't left mashing a button that will
// 429; when unavailable, we tell them when the window opens again.

interface Backup {
  id: string;
  created_at: string;
  ready: boolean;
  dump_url: string | null;
}

interface BackupsPayload {
  backups: Backup[];
  can_create_now: boolean;
  next_available_at: string | null;
}

const messages = defineMessages({
  title: {
    id: 'data_settings.archive_section',
    defaultMessage: 'Archive',
  },
  description: {
    id: 'data_settings.archive_section_desc',
    defaultMessage:
      'Your posts and uploaded media, bundled into one file. Ready ones stay downloadable for a while.',
  },
  request: {
    id: 'data_settings.archive_request',
    defaultMessage: 'Request an archive',
  },
  requesting: {
    id: 'data_settings.archive_requesting',
    defaultMessage: 'Requesting…',
  },
  ready: { id: 'data_settings.archive_ready', defaultMessage: 'Ready' },
  processing: {
    id: 'data_settings.archive_processing',
    defaultMessage: 'Processing…',
  },
  download: {
    id: 'data_settings.archive_download',
    defaultMessage: 'Download',
  },
  createdAt: {
    id: 'data_settings.archive_created_at',
    defaultMessage: 'Requested {when}',
  },
  none: {
    id: 'data_settings.archive_none',
    defaultMessage: 'No archives yet.',
  },
  rateLimited: {
    id: 'data_settings.archive_rate_limited',
    defaultMessage: 'You can request a new archive after {when}.',
  },
  loadError: {
    id: 'data_settings.archive_load_error',
    defaultMessage: 'Couldn’t load your archives.',
  },
  createError: {
    id: 'data_settings.archive_create_error',
    defaultMessage: 'Couldn’t request the archive. Try again shortly.',
  },
});

export const ArchiveSection: React.FC = () => {
  const intl = useIntl();
  const [payload, setPayload] = useState<BackupsPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<BackupsPayload>('v1/settings/backups');
        if (!cancelled) setPayload(res);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    setCreateError(null);
    setSaving(true);
    try {
      const res = await apiRequestPost<BackupsPayload>('v1/settings/backups');
      setPayload(res);
    } catch {
      setCreateError(intl.formatMessage(messages.createError));
    } finally {
      setSaving(false);
    }
  }, [intl]);

  const handleRequest = useCallback(() => {
    void request();
  }, [request]);

  return (
    <SettingsSection
      title={intl.formatMessage(messages.title)}
      description={intl.formatMessage(messages.description)}
    >
      {loadError && (
        <div className='settings-page__row-desc data-settings__error'>
          {intl.formatMessage(messages.loadError)}
        </div>
      )}

      {payload && payload.backups.length === 0 && (
        <div className='settings-page__row-desc'>
          {intl.formatMessage(messages.none)}
        </div>
      )}

      {payload?.backups.map((backup) => (
        <div key={backup.id} className='settings-page__row'>
          <div className='settings-page__row-body'>
            <div className='settings-page__row-label'>
              {intl.formatMessage(messages.createdAt, {
                when: (
                  <FormattedDate
                    value={new Date(backup.created_at)}
                    year='numeric'
                    month='short'
                    day='numeric'
                    hour='numeric'
                    minute='numeric'
                  />
                ),
              })}
            </div>
            <div className='settings-page__row-desc'>
              {backup.ready
                ? intl.formatMessage(messages.ready)
                : intl.formatMessage(messages.processing)}
            </div>
          </div>
          <div className='settings-page__row-widget'>
            {backup.ready && backup.dump_url && (
              <a
                className='data-settings__download-btn'
                href={backup.dump_url}
                download
              >
                {intl.formatMessage(messages.download)}
              </a>
            )}
          </div>
        </div>
      ))}

      <div className='data-settings__archive-actions'>
        {payload && !payload.can_create_now && payload.next_available_at && (
          <span className='settings-page__row-desc'>
            {intl.formatMessage(messages.rateLimited, {
              when: (
                <FormattedDate
                  value={new Date(payload.next_available_at)}
                  year='numeric'
                  month='short'
                  day='numeric'
                />
              ),
            })}
          </span>
        )}
        {createError && (
          <span className='data-settings__error'>{createError}</span>
        )}
        <button
          type='button'
          className='data-settings__request-btn'
          onClick={handleRequest}
          disabled={saving || (payload ? !payload.can_create_now : false)}
        >
          {saving
            ? intl.formatMessage(messages.requesting)
            : intl.formatMessage(messages.request)}
        </button>
      </div>
    </SettingsSection>
  );
};
