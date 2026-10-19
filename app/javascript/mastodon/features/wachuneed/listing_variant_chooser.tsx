import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type {
  ApiListingVariantItemJSON,
  ApiListingVariantsJSON,
} from 'mastodon/api_types/wachuneed';

// Choosing what you want of an item that comes in kinds (size, colour), on
// its page. The choices are asked in the seller's order. A value with
// nothing on offer behind it, given what is already picked, cannot be
// tapped; one that is only sold out can, and says so.

const messages = defineMessages({
  soldOut: {
    id: 'wachuneed.availability.sold_out',
    defaultMessage: 'Sold out',
  },
  madeToOrder: {
    id: 'wachuneed.availability.made_to_order',
    defaultMessage: 'Made to order',
  },
});

// By axis index: the value picked.
export type ChosenVariant = Record<number, string>;

const offered = (variants: ApiListingVariantsJSON) =>
  variants.items.filter((item) => item.availability !== 'off');

// The one kind the picks add up to, once every choice has been made.
export const selectedVariant = (
  variants: ApiListingVariantsJSON | null | undefined,
  chosen: ChosenVariant,
): ApiListingVariantItemJSON | null => {
  if (!variants?.axes.length) return null;
  if (variants.axes.some((_, index) => !chosen[index])) return null;

  return (
    offered(variants).find((item) =>
      item.values.every((value, index) => chosen[index] === value),
    ) ?? null
  );
};

interface Props {
  variants: ApiListingVariantsJSON;
  chosen: ChosenVariant;
  onChoose: (chosen: ChosenVariant) => void;
}

export const ListingVariantChooser: React.FC<Props> = ({
  variants,
  chosen,
  onChoose,
}) => {
  const intl = useIntl();

  const handlePick = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const axis = Number(e.currentTarget.dataset.axis);
      onChoose({ ...chosen, [axis]: e.currentTarget.value });
    },
    [chosen, onChoose],
  );

  // The kinds still possible if this axis were set to this value, keeping
  // every other pick as it is.
  const behind = (axis: number, value: string) =>
    offered(variants).filter((item) =>
      item.values.every(
        (itemValue, index) =>
          (index === axis ? value : (chosen[index] ?? itemValue)) === itemValue,
      ),
    );

  const selected = selectedVariant(variants, chosen);

  return (
    <section className='wachuneed-options wachuneed-variants'>
      {variants.axes.map((axis, axisIndex) => (
        <fieldset key={axis.name} className='wachuneed-options__option'>
          <legend className='wachuneed-options__name'>{axis.name}</legend>
          <div className='wachuneed-options__choices'>
            {axis.values.map((value) => {
              const kinds = behind(axisIndex, value);
              const none = kinds.length === 0;
              const gone =
                !none &&
                kinds.every((item) => item.availability === 'sold_out');
              const picked = chosen[axisIndex] === value;
              return (
                <label
                  key={value}
                  className={`wachuneed-options__choice ${picked ? 'wachuneed-options__choice--chosen' : ''} ${none ? 'wachuneed-options__choice--none' : ''}`}
                >
                  <input
                    type='radio'
                    name={`listing-variant-${axisIndex}`}
                    value={value}
                    data-axis={axisIndex}
                    checked={picked}
                    disabled={none}
                    onChange={handlePick}
                  />
                  <span>{value}</span>
                  {gone && (
                    <span className='wachuneed-options__adds'>
                      {intl.formatMessage(messages.soldOut)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {selected && selected.availability !== 'available' && (
        <p className='wachuneed-variants__state'>
          {intl.formatMessage(
            selected.availability === 'sold_out'
              ? messages.soldOut
              : messages.madeToOrder,
          )}
        </p>
      )}
    </section>
  );
};
