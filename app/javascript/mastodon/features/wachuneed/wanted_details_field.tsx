import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  ListingLookingFor,
  ListingWhereMode,
} from 'mastodon/api_types/wachuneed';
import {
  ComposeField,
  ComposeInput,
  ComposeRow,
  ComposeSelect,
} from 'mastodon/components/compose_fields';

import { MAX_SPOTS, WHERE_LABEL, WHERE_MODES, isWhereMode } from './wanted';

// A wanted ad's details beyond a thing (docs/spaces/wachuneed.md, Wanted
// ads): where the work happens (and the area, when it is in person), by
// when it is wanted (or, for someone for a time, the day), and how many
// people it wants.

const messages = defineMessages({
  where: { id: 'wachuneed.wanted_field.where', defaultMessage: 'Where' },
  area: {
    id: 'wachuneed.wanted_field.area',
    defaultMessage: 'Area (suburb or town)',
  },
  by: { id: 'wachuneed.wanted_field.by', defaultMessage: 'By when' },
  on: { id: 'wachuneed.wanted_field.on', defaultMessage: 'What day' },
  spots: {
    id: 'wachuneed.wanted_field.spots',
    defaultMessage: 'How many people',
  },
});

interface Props {
  lookingFor: ListingLookingFor;
  whereMode: ListingWhereMode;
  area: string;
  dueOn: string;
  spots: string;
  onWhereMode: (value: ListingWhereMode) => void;
  onArea: (value: string) => void;
  onDueOn: (value: string) => void;
  onSpots: (value: string) => void;
}

export const WantedDetailsField: React.FC<Props> = ({
  lookingFor,
  whereMode,
  area,
  dueOn,
  spots,
  onWhereMode,
  onArea,
  onDueOn,
  onSpots,
}) => {
  const intl = useIntl();

  const handleWhere = useCallback<React.ChangeEventHandler<HTMLSelectElement>>(
    (e) => {
      const value = e.currentTarget.value;
      if (isWhereMode(value)) onWhereMode(value);
    },
    [onWhereMode],
  );
  const handleArea = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onArea(e.currentTarget.value);
    },
    [onArea],
  );
  const handleDue = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onDueOn(e.currentTarget.value);
    },
    [onDueOn],
  );
  const handleSpots = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      onSpots(e.currentTarget.value);
    },
    [onSpots],
  );

  return (
    <>
      <ComposeRow>
        <ComposeField label={intl.formatMessage(messages.where)}>
          <ComposeSelect value={whereMode} onChange={handleWhere}>
            {WHERE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {intl.formatMessage(WHERE_LABEL[mode])}
              </option>
            ))}
          </ComposeSelect>
        </ComposeField>
        {whereMode !== 'online' && (
          <ComposeField label={intl.formatMessage(messages.area)}>
            <ComposeInput value={area} onChange={handleArea} maxLength={120} />
          </ComposeField>
        )}
      </ComposeRow>

      <ComposeRow>
        <ComposeField
          label={intl.formatMessage(
            lookingFor === 'help' ? messages.on : messages.by,
          )}
        >
          <ComposeInput type='date' value={dueOn} onChange={handleDue} />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.spots)}>
          <ComposeInput
            type='number'
            min={1}
            max={MAX_SPOTS}
            step={1}
            value={spots}
            onChange={handleSpots}
          />
        </ComposeField>
      </ComposeRow>
    </>
  );
};
