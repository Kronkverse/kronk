import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { apiOpenMateConversation } from 'mastodon/api/nudges_conversations';
import { apiGetWachuneedListing } from 'mastodon/api/wachuneed';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { Avatar } from 'mastodon/components/avatar';
import { KornerShell } from 'mastodon/components/korner_shell';
import { ListingPhotos } from 'mastodon/components/listing_photos';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { writeComposerDraft } from 'mastodon/hooks/useComposerDraft';
import { me } from 'mastodon/initial_state';

import {
  ListingOptionsChooser,
  chosenExtraCents,
  formatListingAmount,
} from './listing_options_chooser';

// /hub/wachuneed/listings/:id — the listing detail page. Before this
// existed the grid tiles on /hub/wachuneed rendered as inert divs
// because <SpaceCard> falls back to `as='div'` when no `to=` prop is
// passed, so tapping any listing did nothing (Tal 2026-09-20: 'the
// wachuneed space, i can't open an offering').
//
// Kept intentionally simple for now — the fetch, the four pieces of
// content (title, category chip, photos, description), poster line,
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
  // The message a buyer's choices start, sent to the seller as written.
  enquiry: {
    id: 'wachuneed.detail.enquiry',
    defaultMessage: 'About "{title}": {choices}.',
  },
  enquiryTotal: {
    id: 'wachuneed.detail.enquiry_total',
    defaultMessage: 'About "{title}": {choices}. Total {amount}.',
  },
  seeShop: {
    id: 'wachuneed.detail.see_shop',
    defaultMessage: 'See everything from {shop}',
  },
  matesOnly: {
    id: 'wachuneed.detail.mates_only',
    defaultMessage: 'Only their Mates can message them about this.',
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

  // What the visitor has picked from the seller's options, by option index.
  const [chosen, setChosen] = useState<Record<number, number>>({});
  useEffect(() => {
    setChosen({});
  }, [id]);

  // Edit lives in the Ж menu (docs/design.md): the poster gets an Edit
  // listing moon. There is no inline Edit link.
  const history = useHistory();

  // "Message the poster" with something chosen: open the chat here and
  // leave the choices in its message box as a draft, for the buyer to send
  // or change. Kronk takes no order and no payment; the two of them agree
  // the rest by talking.
  const sellerId = listing?.account?.id;
  const handleMessageWithChoices = useCallback<
    React.MouseEventHandler<HTMLAnchorElement>
  >(
    (e) => {
      if (!listing || !sellerId) return;
      const options = listing.options ?? [];
      const picked = options.flatMap((option, index) => {
        const choice = option.choices[chosen[index] ?? -1];
        return choice ? [`${option.name}: ${choice.label}`] : [];
      });
      // Nothing chosen: the plain link does the job.
      if (picked.length === 0) return;

      e.preventDefault();
      const values = { title: listing.title, choices: picked.join(', ') };
      const text =
        typeof listing.price_cents === 'number'
          ? intl.formatMessage(messages.enquiryTotal, {
              ...values,
              amount: formatListingAmount(
                listing.price_cents + chosenExtraCents(options, chosen),
                listing.price_currency,
              ),
            })
          : intl.formatMessage(messages.enquiry, values);

      apiOpenMateConversation(sellerId)
        .then((conversation) => {
          writeComposerDraft(`nudges:conversation:${conversation.id}`, {
            value: text,
          });
          history.push(`/nudges/${conversation.id}`);
          return undefined;
        })
        .catch(() => {
          history.push(`/nudges/with/${sellerId}`);
        });
    },
    [chosen, history, intl, listing, sellerId],
  );
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
      <ListingPhotos
        full
        photos={
          listing.photos ??
          (listing.photo_url
            ? [
                {
                  id: 'cover',
                  url: listing.photo_url,
                  full_url: listing.photo_full_url,
                },
              ]
            : [])
        }
      />

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

      {listing.kind !== 'wanted' && (listing.options ?? []).length > 0 ? (
        <ListingOptionsChooser
          options={listing.options ?? []}
          chosen={chosen}
          onChoose={setChosen}
          priceCents={listing.price_cents}
          currency={listing.price_currency}
        />
      ) : null}

      {listing.shop && listing.kind !== 'wanted' ? (
        <Link
          to={`/hub/wachuneed/shop/${listing.shop.acct}`}
          className='wachuneed-detail__shop'
        >
          <FormattedMessage
            {...messages.seeShop}
            values={{ shop: listing.shop.name }}
          />
        </Link>
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
            {/* The seller's shop decides whether a non-Mate may write.
                An older server says nothing: offer the link as before. */}
            {!isOwner &&
            listing.state === 'live' &&
            listing.can_message !== false ? (
              <Link
                to={`/nudges/with/${listing.account.id}`}
                className='wachuneed-detail__message-poster'
                onClick={handleMessageWithChoices}
              >
                <FormattedMessage {...messages.messagePoster} />
              </Link>
            ) : null}
            {!isOwner &&
            listing.state === 'live' &&
            listing.can_message === false ? (
              <span className='wachuneed-detail__mates-only'>
                <FormattedMessage {...messages.matesOnly} />
              </span>
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
