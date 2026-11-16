import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiAnswerWanted } from 'mastodon/api/wachuneed_requests';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import {
  ComposeField,
  ComposeInput,
  ComposeTextarea,
} from 'mastodon/components/compose_fields';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { priceHasAmount } from './listing_price_field';

// Answering a wanted ad (docs/spaces/wachuneed.md, Answering a wanted ad):
// "I can do this" (or "I have this", for a thing) opens a short form, what
// you would do and your price, which goes to the poster alone. Kronk takes
// no payment; being chosen is the two of you agreeing, and the rest
// happens in your chat.

const messages = defineMessages({
  canDo: { id: 'wachuneed.answer.can_do', defaultMessage: 'I can do this' },
  have: { id: 'wachuneed.answer.have', defaultMessage: 'I have this' },
  what: {
    id: 'wachuneed.answer.what',
    defaultMessage: 'What you would do, and when',
  },
  whatThing: {
    id: 'wachuneed.answer.what_thing',
    defaultMessage: 'About what you have',
  },
  whatHint: {
    id: 'wachuneed.answer.what_hint',
    defaultMessage: 'Links to work you have done help them choose.',
  },
  price: {
    id: 'wachuneed.answer.price',
    defaultMessage: 'Your price (in AUD)',
  },
  priceHour: {
    id: 'wachuneed.answer.price_hour',
    defaultMessage: 'Your price an hour (in AUD)',
  },
  priceDay: {
    id: 'wachuneed.answer.price_day',
    defaultMessage: 'Your price a day (in AUD)',
  },
  priceWeek: {
    id: 'wachuneed.answer.price_week',
    defaultMessage: 'Your price a week (in AUD)',
  },
  priceMonth: {
    id: 'wachuneed.answer.price_month',
    defaultMessage: 'Your price a month (in AUD)',
  },
  priceSession: {
    id: 'wachuneed.answer.price_session',
    defaultMessage: 'Your price a session (in AUD)',
  },
  send: { id: 'wachuneed.answer.send', defaultMessage: 'Send' },
  sending: { id: 'wachuneed.answer.sending', defaultMessage: 'Sending…' },
  cancel: { id: 'wachuneed.answer.cancel', defaultMessage: 'Cancel' },
  sent: {
    id: 'wachuneed.answer.sent',
    defaultMessage:
      'Sent. Only they see it, and you will hear if they choose you.',
  },
  waiting: {
    id: 'wachuneed.answer.waiting',
    defaultMessage: 'You answered this. You will hear if they choose you.',
  },
  chosen: {
    id: 'wachuneed.answer.chosen',
    defaultMessage: 'They chose you. Sort out the rest in your chat.',
  },
  notChosen: {
    id: 'wachuneed.answer.not_chosen',
    defaultMessage: 'They went with someone else this time.',
  },
  seeMine: { id: 'wachuneed.answer.see_mine', defaultMessage: 'Mine' },
  error: {
    id: 'wachuneed.answer.error',
    defaultMessage: 'That did not send. Try again.',
  },
});

const PRICE_LABEL = {
  hour: messages.priceHour,
  day: messages.priceDay,
  week: messages.priceWeek,
  month: messages.priceMonth,
  session: messages.priceSession,
} as const;

export const AnswerWanted: React.FC<{ listing: ApiListingJSON }> = ({
  listing,
}) => {
  const intl = useIntl();
  const thing = (listing.looking_for ?? 'thing') === 'thing';
  const type = listing.price_type ?? 'fixed';
  // A price to give when the ad names an amount, or asks for one.
  const asksPrice =
    priceHasAmount(type) || type === 'quote' || type === 'offers';

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState(
    type === 'fixed' && typeof listing.price_cents === 'number'
      ? (listing.price_cents / 100).toFixed(2)
      : '',
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(
    listing.my_answer?.state ?? null,
  );

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  const handleMessage = useCallback<
    React.ChangeEventHandler<HTMLTextAreaElement>
  >((e) => {
    setMessage(e.currentTarget.value);
  }, []);
  const handlePrice = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      setPrice(e.currentTarget.value);
    },
    [],
  );

  const errorText = intl.formatMessage(messages.error);
  const handleSend = useCallback(() => {
    const cents = price.trim() ? Math.round(parseFloat(price) * 100) : null;
    setSending(true);
    setError(null);
    apiAnswerWanted(listing.id, {
      message: message.trim(),
      amount_cents: cents !== null && Number.isFinite(cents) ? cents : null,
    })
      .then((answer) => {
        setState(answer.state);
        setOpen(false);
        return undefined;
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : errorText);
      })
      .finally(() => {
        setSending(false);
      });
  }, [errorText, listing.id, message, price]);

  if (state) {
    const said =
      state === 'accepted'
        ? messages.chosen
        : state === 'pending'
          ? messages.waiting
          : messages.notChosen;
    return (
      <p className='wachuneed-detail__asked' role='status'>
        {intl.formatMessage(said)}{' '}
        <Link to='/hub/wachuneed/mine'>
          {intl.formatMessage(messages.seeMine)}
        </Link>
      </p>
    );
  }

  if (listing.state !== 'live') return null;

  const label = intl.formatMessage(thing ? messages.have : messages.canDo);

  if (!open) {
    return (
      <KornerActionBar>
        <KornerPill label={label} variant='primary' onClick={handleOpen} />
      </KornerActionBar>
    );
  }

  return (
    <section className='wachuneed-answer' aria-label={label}>
      <ComposeField
        label={intl.formatMessage(thing ? messages.whatThing : messages.what)}
        hint={thing ? undefined : intl.formatMessage(messages.whatHint)}
      >
        <ComposeTextarea
          value={message}
          onChange={handleMessage}
          rows={4}
          maxLength={1000}
        />
      </ComposeField>
      {asksPrice && (
        <ComposeField
          label={intl.formatMessage(
            listing.price_unit
              ? PRICE_LABEL[listing.price_unit]
              : messages.price,
          )}
        >
          <ComposeInput
            type='number'
            min={0}
            step={0.01}
            value={price}
            onChange={handlePrice}
          />
        </ComposeField>
      )}
      {error && (
        <p className='wachuneed-answer__error' role='alert'>
          {error}
        </p>
      )}
      <KornerActionBar>
        <KornerPill
          label={intl.formatMessage(sending ? messages.sending : messages.send)}
          variant='primary'
          onClick={handleSend}
          disabled={sending || message.trim().length < 10}
        />
        <KornerPill
          label={intl.formatMessage(messages.cancel)}
          onClick={handleClose}
          disabled={sending}
        />
      </KornerActionBar>
    </section>
  );
};
