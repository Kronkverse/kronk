import { useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

// The signed-in account's ₭oin balance, shown in the Kommons column header so
// people always know what they have to back proposals with. Read-only; fetched
// on mount and whenever `refreshKey` changes (bump it after a backing so the
// figure stays honest without a reload).
const messages = defineMessages({
  label: { id: 'governance.koin.label', defaultMessage: 'Your ₭oin balance' },
});

export const KoinBalance: React.FC<{ refreshKey?: number }> = ({
  refreshKey = 0,
}) => {
  const intl = useIntl();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api()
      .get<{ balance: number }>('/api/v1/token_balance')
      .then((res) => {
        if (active) setBalance(res.data.balance);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (balance === null) return null;

  return (
    <span className='kommons-koin' title={intl.formatMessage(messages.label)}>
      <span className='kommons-koin__symbol'>₭</span>
      <span className='kommons-koin__amount'>{balance}</span>
    </span>
  );
};
