import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  NudgeSettingRow,
  QuietHours,
} from 'mastodon/hooks/useNudgeSettings';

import { BooleanWidget } from './setting_widgets';

// The two switches on a nudge row: shown in Nudges, and pushed to your
// phone. A row that isn't shown can't be pushed, so Push greys out. Message
// rows can't be hidden (a message is always in its chat), so they carry
// Push alone. Shared by /settings/notifications and korner settings.

const messages = defineMessages({
  shown: { id: 'nudge_switches.shown', defaultMessage: 'In Nudges' },
  pushed: { id: 'nudge_switches.pushed', defaultMessage: 'Push' },
  shownLabel: {
    id: 'nudge_switches.shown_label',
    defaultMessage: '{label}: show in Nudges',
  },
  pushedLabel: {
    id: 'nudge_switches.pushed_label',
    defaultMessage: '{label}: push to my phone',
  },
  quietOn: {
    id: 'nudge_switches.quiet_on',
    defaultMessage: 'Quiet hours',
  },
  quietFrom: { id: 'nudge_switches.quiet_from', defaultMessage: 'From' },
  quietTo: { id: 'nudge_switches.quiet_to', defaultMessage: 'to' },
});

export const NudgeSwitches: React.FC<{
  row: NudgeSettingRow;
  onShown: (key: string, shown: boolean) => void;
  onPushed: (key: string, pushed: boolean) => void;
}> = ({ row, onShown, onPushed }) => {
  const intl = useIntl();
  const canHide = row.muted !== undefined;
  const shown = !row.muted;

  const handleShown = useCallback(
    (v: boolean) => {
      onShown(row.key, v);
    },
    [onShown, row.key],
  );
  const handlePushed = useCallback(
    (v: boolean) => {
      onPushed(row.key, v);
    },
    [onPushed, row.key],
  );

  return (
    <div className='nudge-switches'>
      {canHide && (
        <span className='nudge-switches__switch'>
          <span className='nudge-switches__caption' aria-hidden='true'>
            {intl.formatMessage(messages.shown)}
          </span>
          <BooleanWidget
            value={shown}
            onChange={handleShown}
            ariaLabel={intl.formatMessage(messages.shownLabel, {
              label: row.label,
            })}
          />
        </span>
      )}
      <span
        className={`nudge-switches__switch${shown ? '' : ' nudge-switches__switch--off'}`}
      >
        <span className='nudge-switches__caption' aria-hidden='true'>
          {intl.formatMessage(messages.pushed)}
        </span>
        <BooleanWidget
          value={shown && row.push}
          onChange={handlePushed}
          disabled={!shown}
          ariaLabel={intl.formatMessage(messages.pushedLabel, {
            label: row.label,
          })}
        />
      </span>
    </div>
  );
};

// Equal start and end is "off" on the server (Nudges::QuietHours).
const OFF: QuietHours = { start: '00:00', end: '00:00' };
const DEFAULT_ON: QuietHours = { start: '22:00', end: '07:00' };

export const QuietHoursControl: React.FC<{
  value: QuietHours;
  onChange: (value: QuietHours) => void;
}> = ({ value, onChange }) => {
  const intl = useIntl();
  const on = value.start !== value.end;

  const handleToggle = useCallback(
    (v: boolean) => {
      onChange(v ? DEFAULT_ON : OFF);
    },
    [onChange],
  );
  const handleStart = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) onChange({ ...value, start: e.target.value });
    },
    [onChange, value],
  );
  const handleEnd = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) onChange({ ...value, end: e.target.value });
    },
    [onChange, value],
  );

  return (
    <div className='nudge-switches nudge-switches--quiet'>
      {on && (
        <span className='nudge-switches__times'>
          <label>
            <span className='nudge-switches__caption'>
              {intl.formatMessage(messages.quietFrom)}
            </span>
            <input type='time' value={value.start} onChange={handleStart} />
          </label>
          <label>
            <span className='nudge-switches__caption'>
              {intl.formatMessage(messages.quietTo)}
            </span>
            <input type='time' value={value.end} onChange={handleEnd} />
          </label>
        </span>
      )}
      <BooleanWidget
        value={on}
        onChange={handleToggle}
        ariaLabel={intl.formatMessage(messages.quietOn)}
      />
    </div>
  );
};
