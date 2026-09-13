/* eslint-disable @typescript-eslint/no-unnecessary-condition --
 * `cancelled` mutates in the useEffect cleanup after the async fetch
 * reads it. TS control-flow doesn't track the mutation across the
 * closure so the checks look "always truthy/falsy", but the guards
 * are load-bearing: without them setState fires after unmount. */

import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, FormattedDate, useIntl } from 'react-intl';

import api, { apiRequestGet, apiRequestPost } from 'mastodon/api';
import {
  SettingsSection,
  SettingsRow,
} from 'mastodon/features/settings/components';

// Native CSV bulk-import section on /settings/data. Replaces the
// /settings/imports Rails page (Tal 2026-09-13 audit).
//
// Wraps /api/v1/settings/imports. Three-step flow:
//   1. User picks type + mode + file, POSTs to /imports — returns an
//      unconfirmed BulkImport with the parsed row count.
//   2. UI shows the preview ("29 rows detected — merge with existing?")
//      + a warning banner if `likely_mismatched` (file looked like a
//      different type than the one they chose).
//   3. User taps Confirm → POST /imports/:id/confirm → state=scheduled
//      → BulkImportWorker runs asynchronously.
// Below the form, past imports render with their state + progress.

interface Import {
  id: string;
  type: string;
  state: 'unconfirmed' | 'scheduled' | 'in_progress' | 'finished';
  mode: 'merge' | 'overwrite';
  total_items: number;
  processed_items: number;
  imported_items: number;
  original_filename: string;
  likely_mismatched: boolean;
  created_at: string;
  finished_at: string | null;
}

const TYPES = [
  'following',
  'blocking',
  'muting',
  'domain_blocking',
  'bookmarks',
  'lists',
] as const;
type ImportType = (typeof TYPES)[number];

const messages = defineMessages({
  title: {
    id: 'data_settings.import_section',
    defaultMessage: 'Import',
  },
  description: {
    id: 'data_settings.import_section_desc',
    defaultMessage:
      'Bring in a CSV of follows, blocks, mutes, lists, or bookmarks — from Kronk, Mastodon, or another server.',
  },

  type: { id: 'data_settings.import.type', defaultMessage: 'What to import' },
  typeFollowing: {
    id: 'data_settings.import.type.following',
    defaultMessage: 'Follows',
  },
  typeBlocking: {
    id: 'data_settings.import.type.blocking',
    defaultMessage: 'Blocks',
  },
  typeMuting: {
    id: 'data_settings.import.type.muting',
    defaultMessage: 'Mutes',
  },
  typeDomainBlocking: {
    id: 'data_settings.import.type.domain_blocking',
    defaultMessage: 'Blocked domains',
  },
  typeBookmarks: {
    id: 'data_settings.import.type.bookmarks',
    defaultMessage: 'Bookmarks',
  },
  typeLists: {
    id: 'data_settings.import.type.lists',
    defaultMessage: 'Lists',
  },

  mode: { id: 'data_settings.import.mode', defaultMessage: 'How to apply' },
  modeMerge: {
    id: 'data_settings.import.mode.merge',
    defaultMessage: 'Merge with existing',
  },
  modeMergeHint: {
    id: 'data_settings.import.mode.merge_hint',
    defaultMessage:
      'Keep what you already have and add the CSV entries on top.',
  },
  modeOverwrite: {
    id: 'data_settings.import.mode.overwrite',
    defaultMessage: 'Replace existing',
  },
  modeOverwriteHint: {
    id: 'data_settings.import.mode.overwrite_hint',
    defaultMessage:
      'Wipe your current list, then import the CSV as your new set. Careful.',
  },

  file: { id: 'data_settings.import.file', defaultMessage: 'CSV file' },
  filePickButton: {
    id: 'data_settings.import.file_pick',
    defaultMessage: 'Choose file…',
  },
  fileNone: {
    id: 'data_settings.import.file_none',
    defaultMessage: 'No file selected.',
  },
  upload: { id: 'data_settings.import.upload', defaultMessage: 'Upload' },
  uploading: {
    id: 'data_settings.import.uploading',
    defaultMessage: 'Uploading…',
  },

  previewTitle: {
    id: 'data_settings.import.preview_title',
    defaultMessage: 'Ready to import',
  },
  previewSummary: {
    id: 'data_settings.import.preview_summary',
    defaultMessage:
      '{count, plural, one {# row} other {# rows}} detected in {filename}.',
  },
  mismatchWarning: {
    id: 'data_settings.import.mismatch',
    defaultMessage:
      'This file looks like a different kind of export than the type you picked. Double-check before confirming.',
  },
  confirm: {
    id: 'data_settings.import.confirm',
    defaultMessage: 'Confirm and start import',
  },
  cancel: { id: 'data_settings.import.cancel', defaultMessage: 'Cancel' },
  confirming: {
    id: 'data_settings.import.confirming',
    defaultMessage: 'Scheduling…',
  },

  historyTitle: {
    id: 'data_settings.import.history_title',
    defaultMessage: 'Past imports',
  },
  historyEmpty: {
    id: 'data_settings.import.history_empty',
    defaultMessage: 'No imports yet.',
  },
  stateUnconfirmed: {
    id: 'data_settings.import.state.unconfirmed',
    defaultMessage: 'Waiting for confirm',
  },
  stateScheduled: {
    id: 'data_settings.import.state.scheduled',
    defaultMessage: 'Scheduled',
  },
  stateInProgress: {
    id: 'data_settings.import.state.in_progress',
    defaultMessage: 'Running… {imported} of {total}',
  },
  stateFinished: {
    id: 'data_settings.import.state.finished',
    defaultMessage: 'Finished — {imported} of {total} imported',
  },

  uploadError: {
    id: 'data_settings.import.upload_error',
    defaultMessage: 'Couldn’t read that CSV. Check the file + selected type.',
  },
  loadError: {
    id: 'data_settings.import.load_error',
    defaultMessage: 'Couldn’t load past imports.',
  },
});

const TYPE_LABELS: Record<ImportType, keyof typeof messages> = {
  following: 'typeFollowing',
  blocking: 'typeBlocking',
  muting: 'typeMuting',
  domain_blocking: 'typeDomainBlocking',
  bookmarks: 'typeBookmarks',
  lists: 'typeLists',
};

const POLL_MS = 2500;

export const ImportSection: React.FC = () => {
  const intl = useIntl();
  const [type, setType] = useState<ImportType>('following');
  const [mode, setMode] = useState<'merge' | 'overwrite'>('merge');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<Import | null>(null);
  const [history, setHistory] = useState<Import[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiRequestGet<{ imports: Import[] }>(
        'v1/settings/imports',
      );
      setHistory(res.imports);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequestGet<{ imports: Import[] }>(
          'v1/settings/imports',
        );
        if (!cancelled) setHistory(res.imports);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll while anything is in-flight (scheduled or in_progress). The
  // Rails page shows the same fresh status on each reload; the SPA
  // just does it silently every few seconds.
  useEffect(() => {
    if (!history) return;
    const anyRunning = history.some(
      (i) => i.state === 'scheduled' || i.state === 'in_progress',
    );
    if (!anyRunning) return;
    const t = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      window.clearInterval(t);
    };
  }, [history, refresh]);

  const onTypeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setType(e.target.value as ImportType);
  }, []);
  const onModeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMode(e.target.value === 'overwrite' ? 'overwrite' : 'merge');
  }, []);
  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  }, []);
  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const upload = useCallback(async () => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    form.append('type', type);
    form.append('mode', mode);
    form.append('data', file);
    try {
      // Multipart uploads bypass the JSON helpers — go through the
      // shared axios instance so auth headers are attached.
      const res = await api().post<{ import: Import }>(
        '/api/v1/settings/imports',
        form,
      );
      setPending(res.data.import);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch {
      setUploadError(intl.formatMessage(messages.uploadError));
    } finally {
      setUploading(false);
    }
  }, [file, type, mode, intl, refresh]);

  const handleUploadSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void upload();
    },
    [upload],
  );

  const cancelPending = useCallback(async () => {
    if (!pending) return;
    try {
      await api().delete(`/api/v1/settings/imports/${pending.id}`);
    } catch {
      // Server rejects if already scheduled — either way, drop from UI.
    }
    setPending(null);
    await refresh();
  }, [pending, refresh]);

  const confirmPending = useCallback(async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      const res = await apiRequestPost<{ import: Import }>(
        `v1/settings/imports/${pending.id}/confirm`,
      );
      setPending(null);
      // Refresh history so the just-confirmed row shows its new state.
      await refresh();
      // If refresh missed it (rare race), append optimistically.
      setHistory((rows) =>
        rows
          ? rows.map((r) => (r.id === res.import.id ? res.import : r))
          : rows,
      );
    } finally {
      setConfirming(false);
    }
  }, [pending, refresh]);

  const handleCancelPending = useCallback(() => {
    void cancelPending();
  }, [cancelPending]);
  const handleConfirmPending = useCallback(() => {
    void confirmPending();
  }, [confirmPending]);

  return (
    <SettingsSection
      title={intl.formatMessage(messages.title)}
      description={intl.formatMessage(messages.description)}
    >
      {/* Upload form (hidden while a pending import is awaiting confirm). */}
      {!pending && (
        <form
          className='data-settings__import-form'
          onSubmit={handleUploadSubmit}
        >
          <SettingsRow label={intl.formatMessage(messages.type)}>
            <select
              className='data-settings__import-select'
              value={type}
              onChange={onTypeChange}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {intl.formatMessage(messages[TYPE_LABELS[t]])}
                </option>
              ))}
            </select>
          </SettingsRow>

          <SettingsRow
            label={intl.formatMessage(messages.mode)}
            description={intl.formatMessage(
              mode === 'merge'
                ? messages.modeMergeHint
                : messages.modeOverwriteHint,
            )}
            stack
          >
            <div className='data-settings__import-modes'>
              <label className='data-settings__import-chip'>
                <input
                  type='radio'
                  name='import-mode'
                  value='merge'
                  checked={mode === 'merge'}
                  onChange={onModeChange}
                />
                {intl.formatMessage(messages.modeMerge)}
              </label>
              <label className='data-settings__import-chip'>
                <input
                  type='radio'
                  name='import-mode'
                  value='overwrite'
                  checked={mode === 'overwrite'}
                  onChange={onModeChange}
                />
                {intl.formatMessage(messages.modeOverwrite)}
              </label>
            </div>
          </SettingsRow>

          <SettingsRow label={intl.formatMessage(messages.file)} stack>
            <div className='data-settings__import-file'>
              <input
                ref={fileInputRef}
                type='file'
                accept='.csv,text/csv'
                onChange={onFileChange}
                hidden
              />
              <button
                type='button'
                className='data-settings__import-pick'
                onClick={pickFile}
              >
                {intl.formatMessage(messages.filePickButton)}
              </button>
              <span className='data-settings__import-filename'>
                {file ? file.name : intl.formatMessage(messages.fileNone)}
              </span>
            </div>
          </SettingsRow>

          <div className='data-settings__archive-actions'>
            {uploadError && (
              <span className='data-settings__error'>{uploadError}</span>
            )}
            <button
              type='submit'
              className='data-settings__request-btn'
              disabled={!file || uploading}
            >
              {uploading
                ? intl.formatMessage(messages.uploading)
                : intl.formatMessage(messages.upload)}
            </button>
          </div>
        </form>
      )}

      {/* Preview + confirm step. */}
      {pending && (
        <div className='data-settings__import-preview'>
          <div className='settings-page__row-label'>
            {intl.formatMessage(messages.previewTitle)}
          </div>
          <div className='settings-page__row-desc'>
            {intl.formatMessage(messages.previewSummary, {
              count: pending.total_items,
              filename: pending.original_filename,
            })}
          </div>
          {pending.likely_mismatched && (
            <div className='data-settings__import-warning'>
              {intl.formatMessage(messages.mismatchWarning)}
            </div>
          )}
          <div className='data-settings__archive-actions'>
            <button
              type='button'
              className='data-settings__import-cancel'
              onClick={handleCancelPending}
              disabled={confirming}
            >
              {intl.formatMessage(messages.cancel)}
            </button>
            <button
              type='button'
              className='data-settings__request-btn'
              onClick={handleConfirmPending}
              disabled={confirming}
            >
              {confirming
                ? intl.formatMessage(messages.confirming)
                : intl.formatMessage(messages.confirm)}
            </button>
          </div>
        </div>
      )}

      {/* History. */}
      <div className='data-settings__import-history-heading'>
        {intl.formatMessage(messages.historyTitle)}
      </div>
      {loadError && (
        <div className='settings-page__row-desc data-settings__error'>
          {intl.formatMessage(messages.loadError)}
        </div>
      )}
      {history !== null && history.length === 0 && (
        <div className='settings-page__row-desc'>
          {intl.formatMessage(messages.historyEmpty)}
        </div>
      )}
      {history?.map((row) => {
        const typeMsg = messages[TYPE_LABELS[row.type as ImportType]];
        return (
          <div key={row.id} className='settings-page__row'>
            <div className='settings-page__row-body'>
              <div className='settings-page__row-label'>
                {typeMsg ? intl.formatMessage(typeMsg) : row.type} ·{' '}
                {row.original_filename}
              </div>
              <div className='settings-page__row-desc'>
                {row.state === 'unconfirmed' &&
                  intl.formatMessage(messages.stateUnconfirmed)}
                {row.state === 'scheduled' &&
                  intl.formatMessage(messages.stateScheduled)}
                {row.state === 'in_progress' &&
                  intl.formatMessage(messages.stateInProgress, {
                    imported: row.imported_items,
                    total: row.total_items,
                  })}
                {row.state === 'finished' &&
                  intl.formatMessage(messages.stateFinished, {
                    imported: row.imported_items,
                    total: row.total_items,
                  })}
                {' · '}
                <FormattedDate
                  value={new Date(row.created_at)}
                  year='numeric'
                  month='short'
                  day='numeric'
                />
              </div>
            </div>
          </div>
        );
      })}
    </SettingsSection>
  );
};
