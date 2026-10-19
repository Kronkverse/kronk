import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiListingOptionJSON } from 'mastodon/api_types/wachuneed';

// The options on a listing's page: each one a row of choices to tap, with
// what a choice adds beside it, and a running total underneath when the
// listing has a price to add to. Nothing is ordered here: what you picked
// is written into your message to the seller (see `listing_detail.tsx`).

const messages = defineMessages({
  adds: { id: 'wachuneed.options.adds', defaultMessage: '+{amount}' },
  total: { id: 'wachuneed.options.total', defaultMessage: 'Total {amount}' },
  extras: {
    id: 'wachuneed.options.extras',
    defaultMessage: 'Adds {amount}',
  },
});

// Kronk is Australia-native: AUD reads "A$25.00", as the server formats it.
export const formatListingAmount = (
  cents: number,
  currency?: string | null,
) => {
  const code = currency ?? 'AUD';
  const symbol = code === 'AUD' ? 'A$' : `${code} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
};

// What the chosen choices add up to, in cents.
export const chosenExtraCents = (
  options: ApiListingOptionJSON[],
  chosen: Record<number, number>,
) =>
  options.reduce(
    (sum, option, index) =>
      sum + (option.choices[chosen[index] ?? -1]?.extra_cents ?? 0),
    0,
  );

interface Props {
  options: ApiListingOptionJSON[];
  // The index of the choice picked in each option, by the option's index.
  chosen: Record<number, number>;
  onChoose: (chosen: Record<number, number>) => void;
  priceCents?: number | null;
  currency?: string | null;
  // How many are being asked for; the total is for all of them.
  quantity?: number;
}

export const ListingOptionsChooser: React.FC<Props> = ({
  options,
  chosen,
  onChoose,
  priceCents,
  currency,
  quantity = 1,
}) => {
  const intl = useIntl();

  const handlePick = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const option = Number(e.currentTarget.dataset.option);
      const choice = Number(e.currentTarget.value);
      onChoose({ ...chosen, [option]: choice });
    },
    [chosen, onChoose],
  );

  if (options.length === 0) return null;

  const extra = chosenExtraCents(options, chosen);
  const hasPrice = typeof priceCents === 'number';

  return (
    <section className='wachuneed-options'>
      {options.map((option, index) => (
        <fieldset key={index} className='wachuneed-options__option'>
          <legend className='wachuneed-options__name'>{option.name}</legend>
          <div className='wachuneed-options__choices'>
            {option.choices.map((choice, choiceIndex) => (
              <label
                key={choiceIndex}
                className={`wachuneed-options__choice ${chosen[index] === choiceIndex ? 'wachuneed-options__choice--chosen' : ''}`}
              >
                <input
                  type='radio'
                  name={`listing-option-${index}`}
                  value={choiceIndex}
                  data-option={index}
                  checked={chosen[index] === choiceIndex}
                  onChange={handlePick}
                />
                <span>{choice.label}</span>
                {choice.extra_cents > 0 && (
                  <span className='wachuneed-options__adds'>
                    {intl.formatMessage(messages.adds, {
                      amount: formatListingAmount(choice.extra_cents, currency),
                    })}
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {(hasPrice || extra > 0) && (
        <p className='wachuneed-options__total' aria-live='polite'>
          {hasPrice
            ? intl.formatMessage(messages.total, {
                amount: formatListingAmount(
                  (priceCents + extra) * quantity,
                  currency,
                ),
              })
            : intl.formatMessage(messages.extras, {
                amount: formatListingAmount(extra * quantity, currency),
              })}
        </p>
      )}
    </section>
  );
};
