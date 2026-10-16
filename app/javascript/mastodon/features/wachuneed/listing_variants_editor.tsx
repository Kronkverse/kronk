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
import { KornerPill } from 'mastodon/components/korner_pill';

// "Variations" on the shop item composer and the listing form
// (docs/spaces/wachuneed.md, The shop builder): what a buyer chooses
// between, and what each kind of the item costs.
//
// A variation is whatever the seller says it is (Colour, Size, Design,
// Leather type), and holds the choices they add to it one at a time (Black,
// Brown). A water bottle varies by size and by colour, and every
// size-and-colour pair is its own thing on the shelf: its own price, and
// its own "have I got one". The form lays out every combination under the
// variations, with a quick fill so thirty rows do not mean thirty prices
// typed.
//
// The choices were one text box split on commas until 2026-10-14 (Tal:
// "I can add a colour, but only one"; typed with spaces, Black and Brown
// became one choice). Each is now added by itself and shown as a pill. The
// state still holds them comma-joined, so a choice cannot contain a comma.

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
  heading: { id: 'wachuneed.variants.heading', defaultMessage: 'Variations' },
  hint: {
    id: 'wachuneed.variants.hint',
    defaultMessage:
      'Optional. A variation is anything a buyer chooses between: colour, size, design, leather type. Name it, then add each choice. The first variation is asked first.',
  },
  addAxis: {
    id: 'wachuneed.variants.add',
    defaultMessage: 'Add a variation',
  },
  axisName: {
    id: 'wachuneed.variants.axis_name',
    defaultMessage: 'Variation name',
  },
  axisNamePlaceholder: {
    id: 'wachuneed.variants.axis_name_placeholder',
    defaultMessage: 'Colour, size…',
  },
  valueFor: {
    id: 'wachuneed.variants.value_for',
    defaultMessage: 'A choice of {variation}',
  },
  valueForUnnamed: {
    id: 'wachuneed.variants.value_for_unnamed',
    defaultMessage: 'A choice of this variation',
  },
  valuePlaceholder: {
    id: 'wachuneed.variants.value_placeholder',
    defaultMessage: 'Add a choice',
  },
  addValue: { id: 'wachuneed.variants.add_value', defaultMessage: 'Add' },
  removeValue: {
    id: 'wachuneed.variants.remove_value',
    defaultMessage: 'Remove {choice}',
  },
  up: { id: 'wachuneed.variants.up', defaultMessage: 'Ask this earlier' },
  down: { id: 'wachuneed.variants.down', defaultMessage: 'Ask this later' },
  remove: {
    id: 'wachuneed.variants.remove',
    defaultMessage: 'Remove variation',
  },
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

// One choice of a variation, as a pill. Tapping it takes it out.
const ChoicePill: React.FC<{
  axis: string;
  value: string;
  onRemove: (axis: string, value: string) => void;
}> = ({ axis, value, onRemove }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onRemove(axis, value);
  }, [axis, onRemove, value]);

  return (
    <KornerPill
      label={value}
      icon={CloseIcon}
      iconId='close'
      onClick={handleClick}
      ariaLabel={intl.formatMessage(messages.removeValue, { choice: value })}
    />
  );
};

const AddChoicePill: React.FC<{
  axis: string;
  onAdd: (axis: string) => void;
}> = ({ axis, onAdd }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onAdd(axis);
  }, [axis, onAdd]);

  return (
    <KornerPill
      label={intl.formatMessage(messages.addValue)}
      onClick={handleClick}
    />
  );
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
  // The choice being typed into each variation, before it is added.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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

  const handleAdd = useCallback(() => {
    nextKey.current += 1;
    setAxes([
      ...state.axes,
      {
        key: `new-${nextKey.current}`,
        name: '',
        values: '',
      },
    ]);
  }, [setAxes, state.axes]);

  // Add what is typed to a variation's choices. A comma still separates,
  // for anyone who types or pastes a list.
  const commitDraft = useCallback(
    (key: string) => {
      const typed = (drafts[key] ?? '').trim();
      if (typed === '') return;
      setDrafts((prev) => ({ ...prev, [key]: '' }));
      setAxes(
        state.axes.map((row) =>
          row.key === key
            ? { ...row, values: [...valuesOf(row), typed].join(', ') }
            : row,
        ),
      );
    },
    [drafts, setAxes, state.axes],
  );

  const handleDraft = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const key = e.currentTarget.dataset.axis ?? '';
      const { value } = e.currentTarget;
      setDrafts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );
  const handleDraftKey = useCallback<
    React.KeyboardEventHandler<HTMLInputElement>
  >(
    (e) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      commitDraft(e.currentTarget.dataset.axis ?? '');
    },
    [commitDraft],
  );
  // Leaving the box adds what was typed, so pressing Save with a choice
  // still in it does not lose the choice.
  const handleDraftBlur = useCallback<
    React.FocusEventHandler<HTMLInputElement>
  >(
    (e) => {
      commitDraft(e.currentTarget.dataset.axis ?? '');
    },
    [commitDraft],
  );
  const removeValue = useCallback(
    (axis: string, value: string) => {
      setAxes(
        state.axes.map((row) =>
          row.key === axis
            ? {
                ...row,
                values: valuesOf(row)
                  .filter((v) => v !== value)
                  .join(', '),
              }
            : row,
        ),
      );
    },
    [setAxes, state.axes],
  );

  const handleAxis = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const { axis } = e.currentTarget.dataset;
      const { value } = e.currentTarget;
      setAxes(
        state.axes.map((row) =>
          row.key === axis ? { ...row, name: value } : row,
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
  return (
    <div className='wachuneed__compose-field wachuneed-variants-edit'>
      <span className='wachuneed__compose-label'>
        <FormattedMessage {...messages.heading} />
      </span>

      {state.axes.map((axis, index) => (
        <div key={axis.key} className='wachuneed-variants-edit__axis'>
          <div className='wachuneed-variants-edit__axis-head'>
            <input
              type='text'
              className='wachuneed__compose-input wachuneed-variants-edit__axis-name'
              value={axis.name}
              data-axis={axis.key}
              onChange={handleAxis}
              maxLength={40}
              aria-label={intl.formatMessage(messages.axisName)}
              placeholder={intl.formatMessage(messages.axisNamePlaceholder)}
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

          {valuesOf(axis).length > 0 && (
            <ul className='wachuneed-variants-edit__values'>
              {valuesOf(axis).map((value) => (
                <li key={value}>
                  <ChoicePill
                    axis={axis.key}
                    value={value}
                    onRemove={removeValue}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className='wachuneed-variants-edit__value-add'>
            <input
              type='text'
              className='wachuneed__compose-input'
              value={drafts[axis.key] ?? ''}
              data-axis={axis.key}
              onChange={handleDraft}
              onKeyDown={handleDraftKey}
              onBlur={handleDraftBlur}
              maxLength={40}
              aria-label={
                axis.name.trim() === ''
                  ? intl.formatMessage(messages.valueForUnnamed)
                  : intl.formatMessage(messages.valueFor, {
                      variation: axis.name.trim(),
                    })
              }
              placeholder={intl.formatMessage(messages.valuePlaceholder)}
            />
            <AddChoicePill axis={axis.key} onAdd={commitDraft} />
          </div>
        </div>
      ))}

      {state.axes.length < MAX_AXES && (
        <div>
          <KornerPill
            label={intl.formatMessage(messages.addAxis)}
            onClick={handleAdd}
          />
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
