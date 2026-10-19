import { useCallback, useRef } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type { ApiListingOptionJSON } from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';

// The Options part of the listing form (docs/spaces/wachuneed.md, Options).
//
// A seller can let people choose: how long, what size, where, which colour.
// Each option is a named group of choices, and a choice can add to the
// price. Nothing shows until the seller asks for one: the form offers a
// row of likely options for the kind of thing being listed, plus
// "Something else", and each one opens as its own small card. That is the
// whole trick for staying tidy with a wide range on offer.

const MAX_OPTIONS = 6;
const MAX_CHOICES = 12;

export interface ChoiceRow {
  key: string;
  label: string;
  // What it adds to the price, as typed ('' for nothing).
  extra: string;
}

export interface OptionRow {
  key: string;
  name: string;
  choices: ChoiceRow[];
}

type Category = 'creation' | 'goods' | 'service';

const messages = defineMessages({
  heading: { id: 'wachuneed.options.heading', defaultMessage: 'Options' },
  hint: {
    id: 'wachuneed.options.hint',
    defaultMessage:
      'Optional. Let people choose what they want, and say what each choice adds to the price. Tap one to add it.',
  },
  custom: {
    id: 'wachuneed.options.custom',
    defaultMessage: 'Something else',
  },
  name: { id: 'wachuneed.options.name', defaultMessage: 'Option name' },
  choice: { id: 'wachuneed.options.choice', defaultMessage: 'Choice' },
  extra: { id: 'wachuneed.options.extra', defaultMessage: 'Adds (AUD)' },
  addChoice: {
    id: 'wachuneed.options.add_choice',
    defaultMessage: 'Add a choice',
  },
  removeChoice: {
    id: 'wachuneed.options.remove_choice',
    defaultMessage: 'Remove choice',
  },
  removeOption: {
    id: 'wachuneed.options.remove_option',
    defaultMessage: 'Remove this option',
  },
  length: { id: 'wachuneed.options.preset.length', defaultMessage: 'Length' },
  style: { id: 'wachuneed.options.preset.style', defaultMessage: 'Style' },
  where: { id: 'wachuneed.options.preset.where', defaultMessage: 'Where' },
  when: { id: 'wachuneed.options.preset.when', defaultMessage: 'When' },
  size: { id: 'wachuneed.options.preset.size', defaultMessage: 'Size' },
  colour: { id: 'wachuneed.options.preset.colour', defaultMessage: 'Colour' },
  condition: {
    id: 'wachuneed.options.preset.condition',
    defaultMessage: 'Condition',
  },
  handover: {
    id: 'wachuneed.options.preset.handover',
    defaultMessage: 'Pickup or delivery',
  },
  medium: { id: 'wachuneed.options.preset.medium', defaultMessage: 'Medium' },
  framing: {
    id: 'wachuneed.options.preset.framing',
    defaultMessage: 'Framing',
  },
  edition: {
    id: 'wachuneed.options.preset.edition',
    defaultMessage: 'Edition',
  },
  halfHour: {
    id: 'wachuneed.options.choice.half_hour',
    defaultMessage: '30 minutes',
  },
  hour: { id: 'wachuneed.options.choice.hour', defaultMessage: '1 hour' },
  myPlace: {
    id: 'wachuneed.options.choice.my_place',
    defaultMessage: 'At my place',
  },
  yourPlace: {
    id: 'wachuneed.options.choice.your_place',
    defaultMessage: 'At yours',
  },
  online: { id: 'wachuneed.options.choice.online', defaultMessage: 'Online' },
  isNew: { id: 'wachuneed.options.choice.new', defaultMessage: 'New' },
  used: { id: 'wachuneed.options.choice.used', defaultMessage: 'Used' },
  pickup: { id: 'wachuneed.options.choice.pickup', defaultMessage: 'Pickup' },
  delivery: {
    id: 'wachuneed.options.choice.delivery',
    defaultMessage: 'Delivery',
  },
  unframed: {
    id: 'wachuneed.options.choice.unframed',
    defaultMessage: 'Unframed',
  },
  framed: { id: 'wachuneed.options.choice.framed', defaultMessage: 'Framed' },
  original: {
    id: 'wachuneed.options.choice.original',
    defaultMessage: 'Original',
  },
  print: { id: 'wachuneed.options.choice.print', defaultMessage: 'Print' },
});

type Message = (typeof messages)[keyof typeof messages];

interface Preset {
  id: string;
  name: Message;
  // Starting choices, for the options where the usual answers are known.
  choices: Message[];
}

const PRESETS: Record<Category, Preset[]> = {
  service: [
    {
      id: 'length',
      name: messages.length,
      choices: [messages.halfHour, messages.hour],
    },
    { id: 'style', name: messages.style, choices: [] },
    {
      id: 'where',
      name: messages.where,
      choices: [messages.myPlace, messages.yourPlace, messages.online],
    },
    { id: 'when', name: messages.when, choices: [] },
  ],
  goods: [
    { id: 'size', name: messages.size, choices: [] },
    { id: 'colour', name: messages.colour, choices: [] },
    {
      id: 'condition',
      name: messages.condition,
      choices: [messages.isNew, messages.used],
    },
    {
      id: 'handover',
      name: messages.handover,
      choices: [messages.pickup, messages.delivery],
    },
  ],
  creation: [
    { id: 'size', name: messages.size, choices: [] },
    { id: 'medium', name: messages.medium, choices: [] },
    {
      id: 'framing',
      name: messages.framing,
      choices: [messages.unframed, messages.framed],
    },
    {
      id: 'edition',
      name: messages.edition,
      choices: [messages.original, messages.print],
    },
  ],
};

// The form's rows from a saved listing, and back to what the server takes.
export const optionRowsFrom = (
  options: ApiListingOptionJSON[] | undefined,
): OptionRow[] =>
  (options ?? []).map((option, i) => ({
    key: `saved-${i}`,
    name: option.name,
    choices: option.choices.map((choice, j) => ({
      key: `saved-${i}-${j}`,
      label: choice.label,
      extra:
        choice.extra_cents > 0 ? (choice.extra_cents / 100).toFixed(2) : '',
    })),
  }));

export const optionRowsToPayload = (
  rows: OptionRow[],
): ApiListingOptionJSON[] =>
  rows.flatMap((row) => {
    const name = row.name.trim();
    const choices = row.choices.flatMap((choice) => {
      const label = choice.label.trim();
      if (label === '') return [];
      const extra = Math.round(parseFloat(choice.extra) * 100);
      return [
        { label, extra_cents: Number.isFinite(extra) && extra > 0 ? extra : 0 },
      ];
    });
    return name === '' || choices.length === 0 ? [] : [{ name, choices }];
  });

interface Props {
  category: Category;
  rows: OptionRow[];
  onChange: (rows: OptionRow[]) => void;
}

export const ListingOptionsEditor: React.FC<Props> = ({
  category,
  rows,
  onChange,
}) => {
  const intl = useIntl();
  const nextKey = useRef(0);
  const newKey = useCallback(() => {
    nextKey.current += 1;
    return `new-${nextKey.current}`;
  }, []);

  const handleAdd = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const preset = PRESETS[category].find(
        (p) => p.id === e.currentTarget.dataset.preset,
      );
      const labels = preset?.choices.map((m) => intl.formatMessage(m)) ?? [];
      // Two rows to start with, filled when the usual answers are known.
      const starting = labels.length > 0 ? labels : ['', ''];

      onChange([
        ...rows,
        {
          key: newKey(),
          name: preset ? intl.formatMessage(preset.name) : '',
          choices: starting.map((label) => ({
            key: newKey(),
            label,
            extra: '',
          })),
        },
      ]);
    },
    [category, intl, newKey, onChange, rows],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const { option } = e.currentTarget.dataset;
      onChange(rows.filter((row) => row.key !== option));
    },
    [onChange, rows],
  );

  const handleName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const { option } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      onChange(
        rows.map((row) => (row.key === option ? { ...row, name: value } : row)),
      );
    },
    [onChange, rows],
  );

  const handleChoice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const { option, choice, field } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      onChange(
        rows.map((row) =>
          row.key === option
            ? {
                ...row,
                choices: row.choices.map((c) =>
                  c.key === choice
                    ? { ...c, [field === 'extra' ? 'extra' : 'label']: value }
                    : c,
                ),
              }
            : row,
        ),
      );
    },
    [onChange, rows],
  );

  const handleChoiceAdd = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const { option } = e.currentTarget.dataset;
      onChange(
        rows.map((row) =>
          row.key === option
            ? {
                ...row,
                choices: [
                  ...row.choices,
                  { key: newKey(), label: '', extra: '' },
                ],
              }
            : row,
        ),
      );
    },
    [newKey, onChange, rows],
  );

  const handleChoiceRemove = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (e) => {
      const { option, choice } = e.currentTarget.dataset;
      onChange(
        rows.map((row) =>
          row.key === option
            ? { ...row, choices: row.choices.filter((c) => c.key !== choice) }
            : row,
        ),
      );
    },
    [onChange, rows],
  );

  // A suggestion already added steps out of the row.
  const taken = new Set(rows.map((row) => row.name.trim().toLowerCase()));
  const suggestions = PRESETS[category].filter(
    (preset) => !taken.has(intl.formatMessage(preset.name).toLowerCase()),
  );

  return (
    <div className='wachuneed__compose-field wachuneed-options-edit'>
      <span className='wachuneed__compose-label'>
        <FormattedMessage {...messages.heading} />
      </span>

      {rows.map((row) => (
        <fieldset key={row.key} className='wachuneed-options-edit__option'>
          <div className='wachuneed-options-edit__option-head'>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={row.name}
              data-option={row.key}
              onChange={handleName}
              maxLength={40}
              aria-label={intl.formatMessage(messages.name)}
              placeholder={intl.formatMessage(messages.name)}
            />
            <button
              type='button'
              className='wachuneed-options-edit__icon'
              data-option={row.key}
              onClick={handleRemove}
              aria-label={intl.formatMessage(messages.removeOption)}
              title={intl.formatMessage(messages.removeOption)}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
          </div>

          <ul className='wachuneed-options-edit__choices'>
            {row.choices.map((choice) => (
              <li key={choice.key} className='wachuneed-options-edit__choice'>
                <input
                  type='text'
                  className='wachuneed__compose-input'
                  value={choice.label}
                  data-option={row.key}
                  data-choice={choice.key}
                  data-field='label'
                  onChange={handleChoice}
                  maxLength={60}
                  aria-label={intl.formatMessage(messages.choice)}
                  placeholder={intl.formatMessage(messages.choice)}
                />
                <input
                  type='number'
                  min={0}
                  step={0.01}
                  className='wachuneed__compose-input wachuneed-options-edit__extra'
                  value={choice.extra}
                  data-option={row.key}
                  data-choice={choice.key}
                  data-field='extra'
                  onChange={handleChoice}
                  aria-label={intl.formatMessage(messages.extra)}
                  placeholder={intl.formatMessage(messages.extra)}
                />
                <button
                  type='button'
                  className='wachuneed-options-edit__icon'
                  data-option={row.key}
                  data-choice={choice.key}
                  onClick={handleChoiceRemove}
                  aria-label={intl.formatMessage(messages.removeChoice)}
                  title={intl.formatMessage(messages.removeChoice)}
                >
                  <Icon id='close' icon={CloseIcon} />
                </button>
              </li>
            ))}
          </ul>

          {row.choices.length < MAX_CHOICES && (
            <button
              type='button'
              className='wachuneed-options-edit__add'
              data-option={row.key}
              onClick={handleChoiceAdd}
            >
              <FormattedMessage {...messages.addChoice} />
            </button>
          )}
        </fieldset>
      ))}

      {rows.length < MAX_OPTIONS && (
        <div className='wachuneed-options-edit__suggestions'>
          {suggestions.map((preset) => (
            <button
              key={preset.id}
              type='button'
              className='wachuneed-options-edit__suggestion'
              data-preset={preset.id}
              onClick={handleAdd}
            >
              {intl.formatMessage(preset.name)}
            </button>
          ))}
          <button
            type='button'
            className='wachuneed-options-edit__suggestion'
            data-preset='custom'
            onClick={handleAdd}
          >
            <FormattedMessage {...messages.custom} />
          </button>
        </div>
      )}

      <p className='wachuneed__compose-hint'>
        <FormattedMessage {...messages.hint} />
      </p>
    </div>
  );
};
