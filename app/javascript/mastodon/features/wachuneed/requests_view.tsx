import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiAnswerRequest,
  apiGetRequests,
} from 'mastodon/api/wachuneed_requests';
import type {
  ApiRequestJSON,
  ApiRequestState,
} from 'mastodon/api/wachuneed_requests';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import {
  CardActions,
  CardBadge,
  CardBody,
  CardMeta,
  CardTitle,
  StandardCard,
} from 'mastodon/components/standard_card';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { formatListingAmount } from './listing_options_chooser';

// /hub/wachuneed/requests — requests for listings (docs/spaces/wachuneed.md,
// Requests). Asked of you first, each with Accept and Decline while it
// waits; then what you asked for, which you can take back while it waits.
// One flow card each (<StandardCard>): where it stands, the listing, who
// and how much, what was chosen and said, and the actions.

const messages = defineMessages({
  loading: {
    id: 'wachuneed.requests.loading',
    defaultMessage: 'Loading requests…',
  },
  empty: {
    id: 'wachuneed.requests.empty',
    defaultMessage: 'No requests yet',
  },
  emptyBody: {
    id: 'wachuneed.requests.empty.body',
    defaultMessage:
      'Choose what you want on a listing and tap Ask for this. What people ask of you shows here too.',
  },
  askedOfYou: {
    id: 'wachuneed.requests.asked_of_you',
    defaultMessage: 'Asked of you',
  },
  youAsked: { id: 'wachuneed.requests.you_asked', defaultMessage: 'You asked' },
  from: { id: 'wachuneed.requests.from', defaultMessage: 'From {name}' },
  to: { id: 'wachuneed.requests.to', defaultMessage: 'To {name}' },
  quantity: { id: 'wachuneed.requests.quantity', defaultMessage: '{count} of' },
  accept: { id: 'wachuneed.requests.accept', defaultMessage: 'Accept' },
  decline: { id: 'wachuneed.requests.decline', defaultMessage: 'Decline' },
  withdraw: {
    id: 'wachuneed.requests.withdraw',
    defaultMessage: 'Take it back',
  },
  declineTitle: {
    id: 'wachuneed.requests.decline_title',
    defaultMessage: 'Decline this request?',
  },
  declineMessage: {
    id: 'wachuneed.requests.decline_message',
    defaultMessage: 'They will hear that you declined.',
  },
  pending: {
    id: 'wachuneed.requests.state.pending',
    defaultMessage: 'Waiting',
  },
  accepted: {
    id: 'wachuneed.requests.state.accepted',
    defaultMessage: 'Accepted',
  },
  declined: {
    id: 'wachuneed.requests.state.declined',
    defaultMessage: 'Declined',
  },
  withdrawn: {
    id: 'wachuneed.requests.state.withdrawn',
    defaultMessage: 'Taken back',
  },
  expired: { id: 'wachuneed.requests.state.expired', defaultMessage: 'Lapsed' },
});

const STATE_LABELS: Record<ApiRequestState, typeof messages.pending> = {
  pending: messages.pending,
  accepted: messages.accepted,
  declined: messages.declined,
  withdrawn: messages.withdrawn,
  expired: messages.expired,
};

type Answer = 'accept' | 'decline' | 'withdraw';

const RequestCard: React.FC<{
  request: ApiRequestJSON;
  side: 'seller' | 'buyer';
  busy: boolean;
  onAnswer: (request: ApiRequestJSON, answer: Answer) => void;
}> = ({ request, side, busy, onAnswer }) => {
  const intl = useIntl();
  const { listing, choices } = request;
  const other = side === 'seller' ? request.buyer : listing.seller;
  const name = other.display_name !== '' ? other.display_name : other.acct;

  const handleAccept = useCallback(() => {
    onAnswer(request, 'accept');
  }, [onAnswer, request]);
  const handleDecline = useCallback(() => {
    onAnswer(request, 'decline');
  }, [onAnswer, request]);
  const handleWithdraw = useCallback(() => {
    onAnswer(request, 'withdraw');
  }, [onAnswer, request]);

  const chosen = [
    ...(choices.variant ?? []),
    ...(choices.options ?? []).map((o) => `${o.name}: ${o.choice}`),
  ];
  const meta = [
    intl.formatMessage(side === 'seller' ? messages.from : messages.to, {
      name,
    }),
    request.quantity > 1
      ? `${intl.formatMessage(messages.quantity, { count: request.quantity })} ${listing.title}`
      : null,
    typeof request.total_cents === 'number'
      ? formatListingAmount(request.total_cents, request.price_currency)
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <StandardCard as='li' variant='flow'>
      <CardBadge>{intl.formatMessage(STATE_LABELS[request.state])}</CardBadge>
      <CardTitle>
        <Link to={`/hub/wachuneed/listings/${listing.id}`}>
          {listing.title}
        </Link>
      </CardTitle>
      <CardMeta>{meta.join(' · ')}</CardMeta>
      {(chosen.length > 0 || request.message) && (
        <CardBody>
          {chosen.length > 0 && <p>{chosen.join(', ')}</p>}
          {request.message && <p>{request.message}</p>}
        </CardBody>
      )}
      {request.state === 'pending' && (
        <CardActions>
          {side === 'seller' ? (
            <>
              <KornerPill
                label={intl.formatMessage(messages.accept)}
                variant='primary'
                onClick={handleAccept}
                disabled={busy}
              />
              <KornerPill
                label={intl.formatMessage(messages.decline)}
                onClick={handleDecline}
                disabled={busy}
              />
            </>
          ) : (
            <KornerPill
              label={intl.formatMessage(messages.withdraw)}
              onClick={handleWithdraw}
              disabled={busy}
            />
          )}
        </CardActions>
      )}
    </StandardCard>
  );
};

export const WachuneedRequests: React.FC = () => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [asked, setAsked] = useState<ApiRequestJSON[]>([]);
  const [mine, setMine] = useState<ApiRequestJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([apiGetRequests('seller'), apiGetRequests('buyer')])
      .then(([ofYou, byYou]) => {
        if (cancelled) return undefined;
        setAsked(ofYou);
        setMine(byYou);
        return undefined;
      })
      .catch(() => {
        // Left empty; the page says there are none.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAnswer = useCallback(
    (request: ApiRequestJSON, answer: Answer) => {
      const send = () => {
        setBusy(true);
        apiAnswerRequest(request.id, answer)
          .then((updated) => {
            const swap = (list: ApiRequestJSON[]) =>
              list.map((r) => (r.id === updated.id ? updated : r));
            setAsked(swap);
            setMine(swap);
            return undefined;
          })
          .catch(() => undefined)
          .finally(() => {
            setBusy(false);
          });
      };

      if (answer !== 'decline') {
        send();
        return;
      }
      void confirm({
        title: intl.formatMessage(messages.declineTitle),
        message: intl.formatMessage(messages.declineMessage),
        confirmLabel: intl.formatMessage(messages.decline),
        destructive: true,
      }).then((ok) => {
        if (ok) send();
        return undefined;
      });
    },
    [confirm, intl],
  );

  if (loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  if (asked.length === 0 && mine.length === 0) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.empty)}
        body={intl.formatMessage(messages.emptyBody)}
      />
    );
  }

  const section = (
    heading: string,
    list: ApiRequestJSON[],
    side: 'seller' | 'buyer',
  ) =>
    list.length > 0 && (
      <section className='wachuneed-shops' aria-label={heading}>
        <h2 className='wachuneed-shops__heading'>{heading}</h2>
        <ul className='wachuneed-requests'>
          {list.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              side={side}
              busy={busy}
              onAnswer={handleAnswer}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <>
      {confirmDialog}
      {section(intl.formatMessage(messages.askedOfYou), asked, 'seller')}
      {section(intl.formatMessage(messages.youAsked), mine, 'buyer')}
    </>
  );
};
