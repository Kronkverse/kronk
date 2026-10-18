import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiFtdBring } from 'mastodon/api/freethedream';
import type { FtdItem, FtdItemRow } from 'mastodon/api_types/freethedream';

import { act } from './act';

// Bringing something. One thing (a gas bottle, a pot) is one tap: "I'll
// bring it", and tap again to take it back. Something counted (about 20
// plates, 5 kg rice) asks how many you're bringing, so the list can say
// how many are coming; the amount it asks for is rough, not a goal, and
// bringing more is extra and welcome (Tal, 2026-10-17).

const messages = defineMessages({
  bring: { id: 'freethedream.bring.one_tap', defaultMessage: 'I’ll bring it' },
  bringing: { id: 'freethedream.bring.mine', defaultMessage: 'Bringing ✓' },
  takeBack: {
    id: 'freethedream.bring.take_back',
    defaultMessage: 'Not bringing {title} after all',
  },
  bringSome: {
    id: 'freethedream.bring.some',
    defaultMessage: 'I’ll bring some',
  },
  bringingAmount: {
    id: 'freethedream.bring.mine_amount',
    defaultMessage: 'Bringing {amount}',
  },
  howMany: {
    id: 'freethedream.bring.how_many',
    defaultMessage: 'How many {title} are you bringing?',
  },
  less: { id: 'freethedream.bring.less', defaultMessage: 'One fewer' },
  more: { id: 'freethedream.bring.more', defaultMessage: 'One more' },
  save: { id: 'freethedream.bring.save', defaultMessage: 'Bring' },
  cancel: { id: 'freethedream.bring.cancel', defaultMessage: 'Cancel' },
  notBringing: {
    id: 'freethedream.bring.not_bringing',
    defaultMessage: 'Not bringing',
  },
});

// Counted: it asks for more than one, or for an amount of something.
export const isCounted = (need: Pick<FtdItemRow, 'quantity' | 'unit'>) =>
  need.quantity > 1 || need.unit !== '';

interface Props {
  need: FtdItemRow;
  onChange: (need: FtdItem) => void;
}

export const BringControl: React.FC<Props> = (props) =>
  isCounted(props.need) ? <BringSome {...props} /> : <BringOne {...props} />;

const BringOne: React.FC<Props> = ({ need, onChange }) => {
  const intl = useIntl();
  const mine = (need.my_quantity ?? 0) > 0;
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(() => {
    setBusy(true);
    void act(apiFtdBring(need.id, mine ? 0 : 1).then(onChange)).finally(() => {
      setBusy(false);
    });
  }, [need.id, mine, onChange]);

  return (
    <button
      type='button'
      className={
        mine
          ? 'freethedream__button freethedream__button--small freethedream__button--quiet'
          : 'freethedream__button freethedream__button--small'
      }
      onClick={toggle}
      disabled={busy}
      aria-pressed={mine}
      title={
        mine
          ? intl.formatMessage(messages.takeBack, { title: need.title })
          : undefined
      }
    >
      {intl.formatMessage(mine ? messages.bringing : messages.bring)}
    </button>
  );
};

const BringSome: React.FC<Props> = ({ need, onChange }) => {
  const intl = useIntl();
  const mine = need.my_quantity ?? 0;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(mine || 1));
  const [busy, setBusy] = useState(false);

  const count = Math.max(0, Number.parseInt(amount, 10) || 0);

  const send = useCallback(
    (quantity: number) => {
      setBusy(true);
      void act(
        apiFtdBring(need.id, quantity).then((next) => {
          setOpen(false);
          onChange(next);
        }),
      ).finally(() => {
        setBusy(false);
      });
    },
    [need.id, onChange],
  );

  const handleOpen = useCallback(() => {
    setAmount(String(mine || 1));
    setOpen(true);
  }, [mine]);
  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);
  const handleLess = useCallback(() => {
    setAmount((a) => String(Math.max(1, (Number.parseInt(a, 10) || 1) - 1)));
  }, []);
  const handleMore = useCallback(() => {
    setAmount((a) => String((Number.parseInt(a, 10) || 0) + 1));
  }, []);
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value.replace(/\D/g, ''));
  }, []);
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (count > 0) send(count);
    },
    [count, send],
  );
  const handleStop = useCallback(() => {
    send(0);
  }, [send]);

  if (!open)
    return (
      <button
        type='button'
        className={
          mine > 0
            ? 'freethedream__button freethedream__button--small freethedream__button--quiet'
            : 'freethedream__button freethedream__button--small'
        }
        onClick={handleOpen}
      >
        {mine > 0
          ? intl.formatMessage(messages.bringingAmount, {
              amount: need.unit ? `${mine} ${need.unit}` : mine,
            })
          : intl.formatMessage(messages.bringSome)}
      </button>
    );

  return (
    <form className='freethedream-bring' onSubmit={handleSubmit}>
      <span className='freethedream-bring__stepper'>
        <button
          type='button'
          className='freethedream-bring__step'
          onClick={handleLess}
          disabled={busy || count <= 1}
          aria-label={intl.formatMessage(messages.less)}
        >
          −
        </button>
        <input
          className='freethedream-bring__input'
          type='text'
          inputMode='numeric'
          value={amount}
          onChange={handleInput}
          aria-label={intl.formatMessage(messages.howMany, {
            title: need.title,
          })}
          // Opening it is asking for a number: put the cursor there.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
        <button
          type='button'
          className='freethedream-bring__step'
          onClick={handleMore}
          disabled={busy}
          aria-label={intl.formatMessage(messages.more)}
        >
          +
        </button>
        {need.unit && (
          <span className='freethedream-bring__unit'>{need.unit}</span>
        )}
      </span>
      <span className='freethedream-bring__actions'>
        <button
          type='submit'
          className='freethedream__button freethedream__button--small'
          disabled={busy || count === 0}
        >
          {intl.formatMessage(messages.save)}
        </button>
        {mine > 0 ? (
          <button
            type='button'
            className='freethedream__link'
            onClick={handleStop}
            disabled={busy}
          >
            {intl.formatMessage(messages.notBringing)}
          </button>
        ) : (
          <button
            type='button'
            className='freethedream__link'
            onClick={handleCancel}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
        )}
      </span>
    </form>
  );
};
