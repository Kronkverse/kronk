import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdBring } from 'mastodon/api/freethedream';
import type { FtdItem, FtdItemRow } from 'mastodon/api_types/freethedream';

import { formatAmount } from './shared';

// "I'll bring 7": one tap opens a stepper set to what's still needed;
// confirm, and it counts at once. Bringing already? Your amount shows and
// can be changed, or set to 0 to take it back.

const messages = defineMessages({
  bring: { id: 'freethedream.bring', defaultMessage: 'Bring' },
  youBring: {
    id: 'freethedream.bring.you',
    defaultMessage: "You're bringing {amount}",
  },
  confirm: { id: 'freethedream.bring.confirm', defaultMessage: 'OK' },
  less: { id: 'freethedream.bring.less', defaultMessage: 'Less' },
  more: { id: 'freethedream.bring.more', defaultMessage: 'More' },
  amount: { id: 'freethedream.bring.amount', defaultMessage: 'How many' },
});

interface Props {
  need: FtdItemRow;
  onChange: (need: FtdItem) => void;
}

export const BringControl: React.FC<Props> = ({ need, onChange }) => {
  const intl = useIntl();
  const mine = need.my_quantity ?? 0;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(mine || Math.max(need.left ?? 1, 1));
  const [busy, setBusy] = useState(false);

  const open = useCallback(() => {
    setAmount(mine || Math.max(need.left ?? 1, 1));
    setEditing(true);
  }, [mine, need.left]);
  const less = useCallback(() => {
    setAmount((a) => Math.max(a - 1, 0));
  }, []);
  const more = useCallback(() => {
    setAmount((a) => a + 1);
  }, []);
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number.parseInt(e.target.value, 10);
    setAmount(Number.isNaN(n) ? 0 : Math.max(n, 0));
  }, []);
  const confirm = useCallback(() => {
    setBusy(true);
    apiFtdBring(need.id, amount)
      .then((next) => {
        setEditing(false);
        setBusy(false);
        onChange(next);
      })
      .catch(() => {
        setBusy(false);
      });
  }, [need.id, amount, onChange]);

  if (editing)
    return (
      <span className='freethedream-bring'>
        <button
          type='button'
          className='freethedream-bring__step'
          onClick={less}
          aria-label={intl.formatMessage(messages.less)}
        >
          −
        </button>
        <input
          className='freethedream-bring__amount'
          type='number'
          min={0}
          value={amount}
          onChange={handleInput}
          aria-label={intl.formatMessage(messages.amount)}
        />
        <button
          type='button'
          className='freethedream-bring__step'
          onClick={more}
          aria-label={intl.formatMessage(messages.more)}
        >
          +
        </button>
        <button
          type='button'
          className='freethedream__button freethedream__button--small'
          onClick={confirm}
          disabled={busy}
        >
          {intl.formatMessage(messages.confirm)}
        </button>
      </span>
    );

  if (mine > 0)
    return (
      <button type='button' className='freethedream__link' onClick={open}>
        {intl.formatMessage(messages.youBring, {
          amount: formatAmount(mine, need.unit),
        })}
      </button>
    );

  return (
    <button
      type='button'
      className='freethedream__button freethedream__button--small'
      onClick={open}
    >
      {intl.formatMessage(messages.bring)}
    </button>
  );
};
