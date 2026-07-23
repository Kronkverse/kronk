import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

// The Koin wallet at the top of the Kommons surface — the money signifier: a
// big minted ₭ coin, the available-of-total balance, and a bar showing how much
// of your Koin is free to stake. Read-only; refetched on mount and whenever
// `refreshKey` changes (bumped after a backing).

interface Wallet {
  available: number;
  staked: number;
  staked_seeds: number;
  total: number;
}

const messages = defineMessages({
  available: {
    id: 'governance.wallet.available',
    defaultMessage: 'Koin available',
  },
});

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

  const { available, total } = wallet;
  const availPct = total > 0 ? (available / total) * 100 : 0;

  return (
    <section className='kommons-wallet'>
      <div className='kommons-wallet__coin-badge' aria-hidden='true'>
        <span className='kommons-wallet__kip'>₭</span>
      </div>

      <div className='kommons-wallet__content'>
        <div className='kommons-wallet__bal'>
          <span className='kommons-wallet__big'>{available}</span>
          <span className='kommons-wallet__of'>/ {total}</span>
        </div>

        <div
          className='kommons-wallet__bar'
          role='img'
          aria-label={intl.formatMessage(messages.available)}
        >
          <div
            className='kommons-wallet__fill'
            style={{ width: `${availPct}%` }}
          />
        </div>
      </div>
    </section>
  );
};
