import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import {
  apiAcceptContributionRequest,
  apiAskToContribute,
  apiContributionRequests,
  apiDeclineContributionRequest,
} from 'mastodon/api/albutts';
import type { ApiContributionRequestJSON } from 'mastodon/api/albutts';

// Asking to add photos to an album you can see but not add to
// (docs/spaces/albutts.md, Asking to add photos). The owner is nudged,
// sees who's asking at the top of the album, and lets them in or not.

const messages = defineMessages({
  ask: { id: 'albutts.requests.ask', defaultMessage: 'Ask to add photos' },
  asked: {
    id: 'albutts.requests.asked',
    defaultMessage: 'Asked to add photos',
  },
  heading: {
    id: 'albutts.requests.heading',
    defaultMessage:
      '{count, plural, one {# person wants} other {# people want}} to add photos',
  },
  accept: { id: 'albutts.requests.accept', defaultMessage: 'Let them add' },
  decline: { id: 'albutts.requests.decline', defaultMessage: 'Decline' },
});

export const AskToContribute: React.FC<{
  albumId: string;
  asked: boolean;
}> = ({ albumId, asked: initiallyAsked }) => {
  const intl = useIntl();
  const [asked, setAsked] = useState(initiallyAsked);
  const [busy, setBusy] = useState(false);

  const ask = useCallback(() => {
    setBusy(true);
    apiAskToContribute(albumId)
      .then(() => {
        setAsked(true);
      })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  }, [albumId]);

  return (
    <button
      type='button'
      className='albutts-btn albutts-btn--ghost'
      onClick={ask}
      disabled={asked || busy}
    >
      {intl.formatMessage(asked ? messages.asked : messages.ask)}
    </button>
  );
};

export const ContributionRequests: React.FC<{
  albumId: string;
  count: number;
  onAccepted: () => void;
}> = ({ albumId, count, onAccepted }) => {
  const intl = useIntl();
  const [requests, setRequests] = useState<ApiContributionRequestJSON[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    apiContributionRequests(albumId)
      .then((list) => {
        if (!cancelled) setRequests(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [albumId, count]);

  const settle = useCallback(
    (id: string, accept: boolean) => {
      setBusy(true);
      (accept
        ? apiAcceptContributionRequest(albumId, id)
        : apiDeclineContributionRequest(albumId, id)
      )
        .then(() => {
          setRequests((prev) => prev.filter((r) => r.id !== id));
          if (accept) onAccepted();
        })
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
        });
    },
    [albumId, onAccepted],
  );

  if (requests.length === 0) return null;

  return (
    <section className='albutts-requests'>
      <h3 className='albutts-requests__heading'>
        {intl.formatMessage(messages.heading, { count: requests.length })}
      </h3>
      <ul className='albutts-requests__list'>
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            busy={busy}
            onSettle={settle}
            acceptLabel={intl.formatMessage(messages.accept)}
            declineLabel={intl.formatMessage(messages.decline)}
          />
        ))}
      </ul>
    </section>
  );
};

const RequestRow: React.FC<{
  request: ApiContributionRequestJSON;
  busy: boolean;
  acceptLabel: string;
  declineLabel: string;
  onSettle: (id: string, accept: boolean) => void;
}> = ({ request, busy, acceptLabel, declineLabel, onSettle }) => {
  const accept = useCallback(() => {
    onSettle(request.id, true);
  }, [request.id, onSettle]);
  const decline = useCallback(() => {
    onSettle(request.id, false);
  }, [request.id, onSettle]);
  const { account } = request;

  return (
    <li className='albutts-requests__row'>
      <Link to={`/@${account.acct}`} className='albutts-requests__who'>
        <img src={account.avatar_static} alt='' />
        <span>{account.display_name || account.acct}</span>
      </Link>
      <div className='albutts-requests__actions'>
        <button
          type='button'
          className='albutts-btn albutts-btn--primary'
          onClick={accept}
          disabled={busy}
        >
          {acceptLabel}
        </button>
        <button
          type='button'
          className='albutts-btn albutts-btn--ghost'
          onClick={decline}
          disabled={busy}
        >
          {declineLabel}
        </button>
      </div>
    </li>
  );
};
