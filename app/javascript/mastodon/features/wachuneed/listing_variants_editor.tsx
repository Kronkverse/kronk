import { useCallback, useMemo, useRef, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import ArrowDownwardIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  ApiListingVariantsJSON,
  ListingVariantAvailability,
} from 'mastodon/api_types/wachuneed';
import { Icon } from 'mastodon/components/icon';

// "Comes in" on the listing form (docs/spaces/wachuneed.md, The shop
// builder): what an item comes in, and what each kind of it costs.
//
// A water bottle comes in sizes and in colours, and every size-and-colour
// pair is its own thing on the shelf: its own price, and its own "have I
// got one". The seller names the choices and their values, in the order a
// buyer should be asked; the form lays out every combination under them,
// with a quick fill so thirty rows do not mean thirty prices typed.

const MAX_AXES = 3;
const SEPARATOR = '\u241f';

export interface AxisRow {
  key: string;
  name: string;
  // The values as typed, separated by commas.
  values: string;
}

interface Cell {
  price: string;
  availability: ListingVariantAvailability;
}

export interface VariantState {
  axes: AxisRow[];
  // By combination (its values joined). A combination with no entry is
  // available and unpriced.
  cells: Record<string, Cell>;
}

export const EMPTY_VARIANTS: VariantState = { axes: [], cells: {} };

const messages = defineMessages({
  heading: { id: 'wachuneed.variants.heading', defaultMessage: 'Comes in' },
  hint: {
    id: 'wachuneed.variants.hint',
    defaultMessage:
      'Optional. For something that comes in sizes, colours or the like. Name each choice and list its values with commas between them; the first choice is asked first.',
  },
  size: { id: 'wachuneed.options.preset.size', defaultMessage: 'Size' },
  colour: { id: 'wachuneed.options.preset.colour', defaultMessage: 'Colour' },
  custom: { id: 'wachuneed.options.custom', defaultMessage: 'Something else' },
  axisName: { id: 'wachuneed.variants.axis_name', defaultMessage: 'Choice' },
  axisValues: {
    id: 'wachuneed.variants.axis_values',
    defaultMessage: 'Values, with commas',
  },
  up: { id: 'wachuneed.variants.up', defaultMessage: 'Ask this earlier' },
  down: { id: 'wachuneed.variants.down', defaultMessage: 'Ask this later' },
  remove: { id: 'wachuneed.variants.remove', defaultMessage: 'Remove choice' },
  fill: { id: 'wachuneed.variants.fill', defaultMessage: 'Quick fill' },
  fillAll: { id: 'wachuneed.variants.fill_all', defaultMessage: 'Every kind' },
  fillBy: { id: 'wachuneed.variants.fill_by', defaultMessage: 'By {choice}' },
  fillWhat: {
    id: 'wachuneed.variants.fill_what',
    defaultMessage: 'Set prices for',
  },
  fillApply: { id: 'wachuneed.variants.fill_apply', defaultMessage: 'Fill in' },
  price: { id: 'wachuneed.variants.price', defaultMessage: 'Price (AUD)' },
  priceFor: {
    id: 'wachuneed.variants.price_for',
    defaultMessage: 'Price for {kind} (AUD)',
  },
  availabilityFor: {
    id: 'wachuneed.variants.availability_for',
    defaultMessage: 'Availability of {kind}',
  },
  available: {
    id: 'wachuneed.availability.available',
    defaultMessage: 'Available',
  },
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
  madeToOrder: {
    id: 'wachuneed.availability.made_to_order',
    defaultMessage: 'Made to order',
  },
  off: { id: 'wachuneed.availability.off', defaultMessage: 'Not offered' },
  kinds: {
    id: 'wachuneed.variants.kinds',
    defaultMessage: '{count, plural, one {# kind} other {# kinds}}',
  },
});

const AVAILABILITY_LABELS = {
  available: messages.available,
  sold_out: messages.soldOut,
  made_to_order: messages.madeToOrder,
  off: messages.off,
} as const;

const AVAILABILITIES = Object.keys(
  AVAILABILITY_LABELS,
) as ListingVariantAvailability[];

const valuesOf = (axis: AxisRow): string[] => [
  ...new Set(
    axis.values
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== ''),
  ),
];

// The axes a buyer will actually be asked: named, with at least one value.
const usableAxes = (state: VariantState) =>
  state.axes
    .map((axis) => ({ name: axis.name.trim(), values: valuesOf(axis) }))
    .filter((axis) => axis.name !== '' && axis.values.length > 0);

const combinationsOf = (lists: string[][]): string[][] =>
  lists.reduce<string[][]>(
    (rows, values) => rows.flatMap((row) => values.map((v) => [...row, v])),
    [[]],
  );

const keyOf = (values: string[]) => values.join(SEPARATOR);

const centsOf = (typed: string): number | null => {
  const cents = Math.round(parseFloat(typed) * 100);
  return typed.trim() !== '' && Number.isFinite(cents) && cents >= 0
    ? cents
    : null;
};

// Every value named, for saying which one a photo shows.
export const variantValues = (state: VariantState): string[] => [
  ...new Set(usableAxes(state).flatMap((axis) => axis.values)),
];

export const hasVariants = (state: VariantState) =>
  usableAxes(state).length > 0;

// An item with nothing to come in is served as an empty object.
export const variantStateFrom = (
  variants: Partial<ApiListingVariantsJSON> | null | undefined,
): VariantState => {
  if (!variants?.axes?.length) return EMPTY_VARIANTS;

  return {
    axes: variants.axes.map((axis, index) => ({
      key: `saved-${index}`,
      name: axis.name,
      values: axis.values.join(', '),
    })),
    cells: Object.fromEntries(
      (variants.items ?? []).map((item) => [
        keyOf(item.values),
        {
          price:
            typeof item.price_cents === 'number'
              ? (item.price_cents / 100).toFixed(2)
              : '',
          availability: item.availability,
        },
      ]),
    ),
  };
};

// What the server takes: the usable axes and one entry per combination.
// With no usable axis the item simply has no variants.
export const variantStateToPayload = (
  state: VariantState,
): ApiListingVariantsJSON | Record<string, never> => {
  const axes = usableAxes(state);
  if (axes.length === 0) return {};

  return {
    axes,
    items: combinationsOf(axes.map((axis) => axis.values)).map((values) => {
      const cell = state.cells[keyOf(values)];
      return {
        values,
        price_cents: centsOf(cell?.price ?? ''),
        availability: cell?.availability ?? 'available',
      };
    }),
  };
};

interface Props {
  state: VariantState;
  onChange: (state: VariantState) => void;
}

export const ListingVariantsEditor: React.FC<Props> = ({ state, onChange }) => {
  const intl = useIntl();
  const nextKey = useRef(0);
  // Quick fill: which axis the prices follow ('' for every kind alike), and
  // what has been typed for each of its values.
  const [fillAxis, setFillAxis] = useState('');
  const [fillPrices, setFillPrices] = useState<Record<string, string>>({});

  const axes = useMemo(() => usableAxes(state), [state]);
  const combinations = useMemo(
    () =>
      axes.length > 0 ? combinationsOf(axes.map((axis) => axis.values)) : [],
    [axes],
  );

  const setAxes = useCallback(
    (next: AxisRow[]) => {
      onChange({ ...state, axes: next });
    },
    [onChange, state],
  );

  const handleAdd = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      nextKey.current += 1;
      setAxes([
        ...state.axes,
        {
          key: `new-${nextKey.current}`,
          name: e.currentTarget.dataset.name ?? '',
          values: '',
        },
      ]);
    },
    [setAxes, state.axes],
  );

  const handleAxis = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const { axis, field } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      setAxes(
        state.axes.map((row) =>
          row.key === axis
            ? { ...row, [field === 'values' ? 'values' : 'name']: value }
            : row,
        ),
      );
    },
    [setAxes, state.axes],
  );

  const handleRemove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const { axis } = e.currentTarget.dataset;
      setAxes(state.axes.filter((row) => row.key !== axis));
    },
    [setAxes, state.axes],
  );

  const handleMove = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (e) => {
      const { axis, by } = e.currentTarget.dataset;
      const from = state.axes.findIndex((row) => row.key === axis);
      const to = from + Number(by);
      const moved = state.axes[from];
      if (!moved || to < 0 || to >= state.axes.length) return;
      const next = state.axes.filter((row) => row.key !== axis);
      next.splice(to, 0, moved);
      // The combinations are keyed in axis order, so what was typed for
      // them follows the axes round.
      const order = state.axes.map((row) => next.indexOf(row));
      const cells: Record<string, Cell> = {};
      const before = usableAxes(state);
      if (before.length === state.axes.length) {
        combinationsOf(before.map((a) => a.values)).forEach((values) => {
          const cell = state.cells[keyOf(values)];
          if (!cell) return;
          const moved2: string[] = [];
          values.forEach((value, index) => {
            moved2[order[index] ?? index] = value;
          });
          cells[keyOf(moved2)] = cell;
        });
      }
      onChange({ axes: next, cells });
    },
    [onChange, state],
  );

  const setCell = useCallback(
    (key: string, patch: Partial<Cell>) => {
      const current = state.cells[key] ?? {
        price: '',
        availability: 'available' as const,
      };
      onChange({
        ...state,
        cells: { ...state.cells, [key]: { ...current, ...patch } },
      });
    },
    [onChange, state],
  );

  const handlePrice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setCell(e.currentTarget.dataset.kind ?? '', {
        price: e.currentTarget.value,
      });
    },
    [setCell],
  );

  const handleAvailability = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >(
    (e) => {
      setCell(e.currentTarget.dataset.kind ?? '', {
        availability: e.currentTarget.value as ListingVariantAvailability,
      });
    },
    [setCell],
  );

  const handleFillAxis = useCallback<
    React.ChangeEventHandler<HTMLSelectElement>
  >((e) => {
    setFillAxis(e.currentTarget.value);
    setFillPrices({});
  }, []);

  const handleFillPrice = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => {
    const { value } = e.currentTarget;
    const name = e.currentTarget.dataset.value ?? '';
    setFillPrices((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFill = useCallback(() => {
    const index = axes.findIndex((axis) => axis.name === fillAxis);
    const cells = { ...state.cells };
    combinations.forEach((values) => {
      const typed = fillPrices[index >= 0 ? (values[index] ?? '') : ''];
      if (typed === undefined || typed.trim() === '') return;
      const key = keyOf(values);
      cells[key] = {
        availability: cells[key]?.availability ?? 'available',
        price: typed,
      };
    });
    onChange({ ...state, cells });
  }, [axes, combinations, fillAxis, fillPrices, onChange, state]);

  const fillIndex = axes.findIndex((axis) => axis.name === fillAxis);
  const fillValues = fillIndex >= 0 ? (axes[fillIndex]?.values ?? []) : [''];
  const named = new Set(
    state.axes.map((axis) => axis.name.trim().toLowerCase()),
  );
  const presets = [messages.size, messages.colour]
    .map((message) => intl.formatMessage(message))
    .filter((name) => !named.has(name.toLowerCase()));

  return (
    <div className='wachuneed__compose-field wachuneed-variants-edit'>
      <span className='wachuneed__compose-label'>
        <FormattedMessage {...messages.heading} />
      </span>

      {state.axes.map((axis, index) => (
        <div key={axis.key} className='wachuneed-variants-edit__axis'>
          <input
            type='text'
            className='wachuneed__compose-input wachuneed-variants-edit__axis-name'
            value={axis.name}
            data-axis={axis.key}
            data-field='name'
            onChange={handleAxis}
            maxLength={40}
            aria-label={intl.formatMessage(messages.axisName)}
            placeholder={intl.formatMessage(messages.axisName)}
          />
          <input
            type='text'
            className='wachuneed__compose-input'
            value={axis.values}
            data-axis={axis.key}
            data-field='values'
            onChange={handleAxis}
            aria-label={intl.formatMessage(messages.axisValues)}
            placeholder={intl.formatMessage(messages.axisValues)}
          />
          <button
            type='button'
            className='wachuneed-options-edit__icon'
            data-axis={axis.key}
            data-by='-1'
            onClick={handleMove}
            disabled={index === 0}
            aria-label={intl.formatMessage(messages.up)}
            title={intl.formatMessage(messages.up)}
          >
            <Icon id='arrow_upward' icon={ArrowUpwardIcon} />
          </button>
          <button
            type='button'
            className='wachuneed-options-edit__icon'
            data-axis={axis.key}
            data-by='1'
            onClick={handleMove}
            disabled={index === state.axes.length - 1}
            aria-label={intl.formatMessage(messages.down)}
            title={intl.formatMessage(messages.down)}
          >
            <Icon id='arrow_downward' icon={ArrowDownwardIcon} />
          </button>
          <button
            type='button'
            className='wachuneed-options-edit__icon'
            data-axis={axis.key}
            onClick={handleRemove}
            aria-label={intl.formatMessage(messages.remove)}
            title={intl.formatMessage(messages.remove)}
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
        </div>
      ))}

      {state.axes.length < MAX_AXES && (
        <div className='wachuneed-options-edit__suggestions'>
          {presets.map((name) => (
            <button
              key={name}
              type='button'
              className='wachuneed-options-edit__suggestion'
              data-name={name}
              onClick={handleAdd}
            >
              {name}
            </button>
          ))}
          <button
            type='button'
            className='wachuneed-options-edit__suggestion'
            data-name=''
            onClick={handleAdd}
          >
            <FormattedMessage {...messages.custom} />
          </button>
        </div>
      )}

      {combinations.length > 0 && (
        <div className='wachuneed-variants-edit__kinds'>
          <div className='wachuneed-variants-edit__fill'>
            <label className='wachuneed-variants-edit__fill-what'>
              <span>
                <FormattedMessage {...messages.fillWhat} />
              </span>
              <select
                className='wachuneed__compose-input'
                value={fillAxis}
                onChange={handleFillAxis}
              >
                <option value=''>{intl.formatMessage(messages.fillAll)}</option>
                {axes.map((axis) => (
                  <option key={axis.name} value={axis.name}>
                    {intl.formatMessage(messages.fillBy, { choice: axis.name })}
                  </option>
                ))}
              </select>
            </label>
            {fillValues.map((value) => (
              <label
                key={value}
                className='wachuneed-variants-edit__fill-price'
              >
                {value !== '' && <span>{value}</span>}
                <input
                  type='number'
                  min={0}
                  step={0.01}
                  className='wachuneed__compose-input'
                  value={fillPrices[value] ?? ''}
                  data-value={value}
                  onChange={handleFillPrice}
                  aria-label={
                    value === ''
                      ? intl.formatMessage(messages.price)
                      : intl.formatMessage(messages.priceFor, { kind: value })
                  }
                  placeholder={intl.formatMessage(messages.price)}
                />
              </label>
            ))}
            <button
              type='button'
              className='wachuneed-options-edit__add'
              onClick={handleFill}
            >
              <FormattedMessage {...messages.fillApply} />
            </button>
          </div>

          <p className='wachuneed-variants-edit__count'>
            {intl.formatMessage(messages.kinds, { count: combinations.length })}
          </p>

          <ul className='wachuneed-variants-edit__grid'>
            {combinations.map((values) => {
              const key = keyOf(values);
              const kind = values.join(' · ');
              const cell = state.cells[key];
              return (
                <li key={key} className='wachuneed-variants-edit__kind'>
                  <span className='wachuneed-variants-edit__kind-name'>
                    {kind}
                  </span>
                  <input
                    type='number'
                    min={0}
                    step={0.01}
                    className='wachuneed__compose-input'
                    value={cell?.price ?? ''}
                    data-kind={key}
                    onChange={handlePrice}
                    aria-label={intl.formatMessage(messages.priceFor, { kind })}
                    placeholder={intl.formatMessage(messages.price)}
                  />
                  <select
                    className='wachuneed__compose-input'
                    value={cell?.availability ?? 'available'}
                    data-kind={key}
                    onChange={handleAvailability}
                    aria-label={intl.formatMessage(messages.availabilityFor, {
                      kind,
                    })}
                  >
                    {AVAILABILITIES.map((value) => (
                      <option key={value} value={value}>
                        {intl.formatMessage(AVAILABILITY_LABELS[value])}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className='wachuneed__compose-hint'>
        <FormattedMessage {...messages.hint} />
      </p>
    </div>
  );
};
