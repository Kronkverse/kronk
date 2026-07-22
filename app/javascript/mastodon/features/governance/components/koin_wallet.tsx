import { useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import api from 'mastodon/api';

// The ₭oin wallet card at the top of the Kommons surface. It's people's
// governance weight, so it's given the presence of a wallet rather than a
// counter: available-of-total balance, a staked-vs-available bar, and a plain
// reminder that staking is never spending. Read-only; refetched on mount and
// whenever `refreshKey` changes (bumped after a backing).

interface Wallet {
  available: number;
  staked: number;
  staked_seeds: number;
  total: number;
}

const messages = defineMessages({
  label: { id: 'governance.wallet.label', defaultMessage: 'Your ₭oin' },
  info: {
    id: 'governance.wallet.info',
    defaultMessage:
      '₭oin is your governance weight. Stake it behind proposals you support; it returns to you when a proposal resolves.',
  },
  available: {
    id: 'governance.wallet.available',
    defaultMessage: '₭oin available',
  },
});

const CoinIcon = () => (
  <svg
    className='kommons-wallet__coin'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={1.75}
    aria-hidden='true'
  >
    <circle cx={12} cy={12} r={8.4} />
    <circle cx={12} cy={12} r={4} />
  </svg>
);

export const KoinWallet: React.FC<{ refreshKey?: number }> = ({
  refreshKey = 0,
}) => {
  const intl = useIntl();
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    let active = true;
    api()
      .get<Wallet>('/api/v1/token_balance')
      .then((res) => {
        if (active) setWallet(res.data);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (wallet === null) return null;

  const { available, staked, staked_seeds: stakedSeeds, total } = wallet;
  const stakedPct = total > 0 ? (staked / total) * 100 : 0;
  const availPct = total > 0 ? (available / total) * 100 : 0;

  return (
    <section className='kommons-wallet'>
      <div className='kommons-wallet__top'>
        <CoinIcon />
        <span className='kommons-wallet__label'>
          {intl.formatMessage(messages.label)}
        </span>
        <span
          className='kommons-wallet__info'
          title={intl.formatMessage(messages.info)}
          aria-label={intl.formatMessage(messages.info)}
        >
          i
        </span>
      </div>

      <div className='kommons-wallet__bal'>
        <span className='kommons-wallet__big'>{available}</span>
        <span className='kommons-wallet__of'>/ {total}</span>
        <span className='kommons-wallet__unit'>
          {intl.formatMessage(messages.available)}
        </span>
      </div>

      <div
        className='kommons-wallet__bar'
        role='img'
        aria-label={intl.formatMessage(messages.available)}
      >
        <div
          className='kommons-wallet__staked-fill'
          style={{ width: `${stakedPct}%` }}
        />
        <div
          className='kommons-wallet__avail-fill'
          style={{ width: `${availPct}%` }}
        />
      </div>

      <div className='kommons-wallet__foot'>
        <span className='kommons-wallet__leg'>
          <span className='kommons-wallet__dot kommons-wallet__dot--staked' />
          <FormattedMessage
            id='governance.wallet.staked'
            defaultMessage='Staked {staked} across {seeds, plural, one {# proposal} other {# proposals}}'
            values={{
              staked: <b>{staked}</b>,
              seeds: stakedSeeds,
            }}
          />
        </span>
        <span className='kommons-wallet__leg'>
          <span className='kommons-wallet__dot kommons-wallet__dot--avail' />
          <FormattedMessage
            id='governance.wallet.available_legend'
            defaultMessage='Available {available}'
            values={{ available: <b>{available}</b> }}
          />
        </span>
      </div>

      <p className='kommons-wallet__note'>
        <FormattedMessage
          id='governance.wallet.note'
          defaultMessage='₭oin returns to you when a proposal resolves. Nothing is spent for good.'
        />
      </p>
    </section>
  );
};
