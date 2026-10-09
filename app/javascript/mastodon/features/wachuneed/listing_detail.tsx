import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiGetWachuneedListing } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { Avatar } from 'mastodon/components/avatar';
import { KornerShell } from 'mastodon/components/korner_shell';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { me } from 'mastodon/initial_state';

// /hub/wachuneed/listings/:id — the listing detail page. Before this
// existed the grid tiles on /hub/wachuneed rendered as inert divs
// because <SpaceCard> falls back to `as='div'` when no `to=` prop is
// passed, so tapping any listing did nothing (Tal 2026-09-20: 'the
// wachuneed space, i can't open an offering').
//
// Kept intentionally simple for now — the fetch, the four pieces of
// content (title, category chip, photo, description), poster line,
// and a "Message the poster" affordance that routes to Nudges. Making
// an offer (POST /api/v1/wachuneed/listings/:id/offers, model
// ListingOffer) needs its own composer; noted as follow-up.

const messages = defineMessages({
  loading: {
    id: 'wachuneed.detail.loading',
    defaultMessage: 'Loading listing…',
  },
  gone: {
    id: 'wachuneed.detail.gone',
    defaultMessage: "This listing isn't available.",
  },
  back: {
    id: 'wachuneed.detail.back',
    defaultMessage: 'Back to Wachuneed',
  },
  postedBy: {
    id: 'wachuneed.detail.posted_by',
    defaultMessage: 'Posted by',
  },
  messagePoster: {
    id: 'wachuneed.detail.message_poster',
    defaultMessage: 'Message the poster',
  },
  reservedNotice: {
    id: 'wachuneed.detail.reserved',
    defaultMessage: 'This listing is on hold for another Kronker.',
  },
  closedNotice: {
    id: 'wachuneed.detail.closed',
    defaultMessage: 'This listing is closed.',
  },
  edit: {
    id: 'wachuneed.detail.edit',
    defaultMessage: 'Edit listing',
  },
  wanted: { id: 'wachuneed.kind.wanted', defaultMessage: 'Looking for' },
  budget: { id: 'wachuneed.detail.budget', defaultMessage: 'Budget' },
});

const CATEGORY_LABELS = defineMessages({
  creation: { id: 'wachuneed.category.art', defaultMessage: 'Art' },
  goods: { id: 'wachuneed.category.stuff', defaultMessage: 'Stuff' },
  service: { id: 'wachuneed.category.offerings', defaultMessage: 'Offerings' },
});

const ListingDetailBody: React.FC<{ id: string }> = ({ id }) => {
  const intl = useIntl();
  const [listing, setListing] = useState<ApiListingJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    apiGetWachuneedListing(id)
      .then((data) => {
        if (cancelled) return;
        setListing(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Edit lives in the Ж menu (docs/design.md): the poster gets an Edit
  // listing moon. There is no inline Edit link.
  const history = useHistory();
  const handleEditFromMenu = useCallback(() => {
    history.push(`/hub/wachuneed/listings/${id}/edit`);
  }, [history, id]);
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEditFromMenu,
    !!me && !!listing && listing.account?.id === me,
  );

  if (loading) {
    return (
      <p className='wachuneed__status'>
        {intl.formatMessage(messages.loading)}
      </p>
    );
  }

  if (error || !listing) {
    return (
      <div className='wachuneed-detail wachuneed-detail--error'>
        <p className='wachuneed__status'>{intl.formatMessage(messages.gone)}</p>
        <Link to='/hub/wachuneed' className='wachuneed-detail__back'>
          {intl.formatMessage(messages.back)}
        </Link>
      </div>
    );
  }

  const categoryLabel =
    listing.category in CATEGORY_LABELS
      ? intl.formatMessage(
          CATEGORY_LABELS[listing.category as keyof typeof CATEGORY_LABELS],
        )
      : null;

  // The poster edits from the Ж menu; everyone else gets "Message the
  // poster" here.
  const isOwner = !!me && listing.account?.id === me;

  const stateNotice =
    listing.state === 'reserved'
      ? messages.reservedNotice
      : listing.state === 'closed'
        ? messages.closedNotice
        : null;

  return (
    <article className='wachuneed-detail'>
      {listing.photo_full_url || listing.photo_url ? (
        <img
          className='wachuneed-detail__photo'
          src={listing.photo_full_url ?? listing.photo_url ?? undefined}
          alt=''
        />
      ) : null}

      <header className='wachuneed-detail__header'>
        <h1 className='wachuneed-detail__title'>{listing.title}</h1>
        <div className='wachuneed-detail__meta'>
          {listing.kind === 'wanted' ? (
            <span className='wachuneed-detail__chip wachuneed-detail__chip--wanted'>
              {intl.formatMessage(messages.wanted)}
            </span>
          ) : null}
          {categoryLabel ? (
            <span
              className={`wachuneed-detail__chip wachuneed-detail__chip--${listing.category}`}
            >
              {categoryLabel}
            </span>
          ) : null}
          {listing.price_display ? (
            <span className='wachuneed-detail__price'>
              {listing.kind === 'wanted'
                ? `${intl.formatMessage(messages.budget)} ${listing.price_display}`
                : listing.price_display}
            </span>
          ) : null}
          {listing.location ? (
            <span className='wachuneed-detail__location'>
              {listing.location}
            </span>
          ) : null}
        </div>
      </header>

      {stateNotice ? (
        <p className='wachuneed-detail__notice'>
          {intl.formatMessage(stateNotice)}
        </p>
      ) : null}

      {listing.description ? (
        <p className='wachuneed-detail__description'>{listing.description}</p>
      ) : null}

      {listing.account ? (
        <footer className='wachuneed-detail__poster'>
          <Link
            to={`/@${listing.account.acct}`}
            className='wachuneed-detail__poster-link'
          >
            <Avatar account={listing.account} size={40} />
            <span className='wachuneed-detail__poster-name'>
              <span className='wachuneed-detail__poster-label'>
                {intl.formatMessage(messages.postedBy)}
              </span>
              <span className='wachuneed-detail__poster-acct'>
                {listing.account.display_name || `@${listing.account.acct}`}
              </span>
            </span>
          </Link>
          <div className='wachuneed-detail__actions'>
            {!isOwner && listing.state === 'live' ? (
              <Link
                to={`/nudges/${listing.account.id}`}
                className='wachuneed-detail__message-poster'
              >
                <FormattedMessage {...messages.messagePoster} />
              </Link>
            ) : null}
          </div>
        </footer>
      ) : null}
    </article>
  );
};

const ListingDetail: React.FC<{ multiColumn?: boolean }> = () => {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  return (
    <KornerShell
      slug='wachuneed'
      label={intl.formatMessage({
        id: 'wachuneed.title',
        defaultMessage: 'Wachuneed',
      })}
      className='scrollable wachuneed wachuneed--detail'
      defaultView='detail'
      views={{
        detail: () => <ListingDetailBody id={id} />,
      }}
    />
  );
};

// eslint-disable-next-line import/no-default-export
export default ListingDetail;
