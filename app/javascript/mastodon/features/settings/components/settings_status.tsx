import { defineMessages, useIntl } from 'react-intl';

// Autosave status pill. Rendered only when the page is actually doing
// something (saving / saved / error) — idle stays invisible so the
// header doesn't have a permanent empty row.
//
// Copy is shared across every settings page; the previous per-page
// duplicates (appearance-settings, posting-settings, notifications-
// settings) all had the same strings.

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const messages = defineMessages({
  saving: { id: 'settings_status.saving', defaultMessage: 'Saving…' },
  saved: { id: 'settings_status.saved', defaultMessage: 'Saved' },
  error: { id: 'settings_status.error', defaultMessage: 'Couldn’t save' },
});

interface Props {
  status: SaveStatus;
}

export const SettingsStatus: React.FC<Props> = ({ status }) => {
  const intl = useIntl();
  if (status === 'idle') return null;
  const label =
    status === 'saving'
      ? intl.formatMessage(messages.saving)
      : status === 'saved'
        ? intl.formatMessage(messages.saved)
        : intl.formatMessage(messages.error);
  return (
    <span
      className={`settings-page__status settings-page__status--${status}`}
      role='status'
    >
      {label}
    </span>
  );
};
