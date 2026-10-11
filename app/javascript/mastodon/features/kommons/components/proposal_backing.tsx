import { useCallback, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

import type { Proposal } from '../types';

// The support panel — token backing is how you support a proposal (spec:
// docs/spaces/kommons.md (Proposal page), support model). ₭ is scarce, so a stake is real
// commitment, not a free click. Promoted to the top of the page as the primary
// action. Backing is locked until the proposal closes or is annulled.

const messages = defineMessages({
  amount: { id: 'backing.amount_placeholder', defaultMessage: '₭' },
  back: { id: 'backing.back', defaultMessage: 'Back' },
  backing: { id: 'backing.backing', defaultMessage: 'Backing…' },
});

export const ProposalBacking: React.FC<{
  proposal: Proposal;
  onUpdate: (updated: Proposal) => void;
}> = ({ proposal, onUpdate }) => {
  const intl = useIntl();
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { backing } = proposal;

  const handleAmount = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const n = Number.parseInt(amount, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setError('Enter a positive number of ₭.');
        return;
      }
      setPending(true);
      setError(null);
      api()
        .post<Proposal>(`/api/v1/proposals/${proposal.id}/back`, { amount: n })
        .then((res) => {
          onUpdate(res.data);
          setAmount('');
          return undefined;
        })
        .catch(() => {
          setError('Could not back this proposal.');
        })
        .finally(() => {
          setPending(false);
        });
    },
    [amount, proposal.id, onUpdate],
  );

  // One line: what's backed, and a way to back it. No heading, rank or
  // explainer — how backing works belongs in page info, not on every page.
  return (
    <section className='proposal-backing'>
      <div className='proposal-backing__figures'>
        <span className='proposal-backing__total'>₭{backing.total}</span>
        <span className='proposal-backing__sub'>
          <FormattedMessage
            id='backing.backers'
            defaultMessage='{count, plural, one {# backer} other {# backers}}'
            values={{ count: backing.backers }}
          />
          {backing.my_stake > 0 && (
            <>
              {' · '}
              <FormattedMessage
                id='backing.your_stake'
                defaultMessage='you staked ₭{stake}'
                values={{ stake: backing.my_stake }}
              />
            </>
          )}
        </span>
      </div>
      {backing.open && backing.my_balance !== null ? (
        <form className='proposal-backing__form' onSubmit={submit}>
          <input
            type='number'
            min='1'
            max={backing.my_balance}
            className='proposal-backing__input'
            value={amount}
            onChange={handleAmount}
            placeholder={intl.formatMessage(messages.amount)}
            aria-label='Tokens to back'
            disabled={pending || backing.my_balance === 0}
          />
          <button
            type='submit'
            className='proposal-backing__btn'
            disabled={pending || backing.my_balance === 0}
          >
            {pending
              ? intl.formatMessage(messages.backing)
              : intl.formatMessage(messages.back)}
          </button>
          <span className='proposal-backing__balance'>
            <FormattedMessage
              id='backing.available'
              defaultMessage='₭{balance} available'
              values={{ balance: backing.my_balance }}
            />
          </span>
        </form>
      ) : (
        !backing.open && (
          <p className='proposal-backing__closed'>
            <FormattedMessage
              id='backing.closed'
              defaultMessage='Backing is closed.'
            />
          </p>
        )
      )}
      {error && <p className='proposal-backing__error'>{error}</p>}
    </section>
  );
};
