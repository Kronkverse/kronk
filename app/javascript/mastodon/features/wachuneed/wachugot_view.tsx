import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory } from 'react-router-dom';

import { apiGetWachugotListings } from 'mastodon/api/wachuneed';
import { apiGetMyWachuneedShop } from 'mastodon/api/wachuneed_shops';
import type { ApiShopJSON } from 'mastodon/api/wachuneed_shops';
import type { ApiListingJSON } from 'mastodon/api_types/wachuneed';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';

import { ListingCard } from './listing_card';
import { RequestSection, useWachuneedRequests } from './requests_view';
import { ShopCard } from './shop_card';

// Mine — your own corner of Wachuneed (Tal, 2026-11-16: "shows me the jobs
// that I have going on, the things that I'm selling, the things that I've
// bought, as well as my shop front"). Top to bottom, each left out when
// there is nothing in it:
//
//   Waiting on you     requests for your listings and answers to your
//                      wanted ads, still to accept or choose
//   Work you're doing  your answers that were chosen; then the rest of
//                      your answers (Answered by you)
//   Your wanted ads    what you are looking for, in every state; then the
//                      people you chose for them
//   My shop            your shop's card, or Open a shop (its own section
//                      since 2026-11-16, Tal)
//   Selling            what you offer; then the requests you accepted
//                      (Sold and booked)
//   Bought and booked  what you asked for on other people's listings
//
// The requests are the same cards as before (requests_view.tsx), and the
// listings the same tiles as the one page.

const messages = defineMessages({
  loading: { id: 'wachuneed.mine.loading', defaultMessage: 'Loading…' },
  waiting: {
    id: 'wachuneed.mine.waiting',
    defaultMessage: 'Waiting on you',
  },
  working: {
    id: 'wachuneed.mine.working',
    defaultMessage: "Work you're doing",
  },
  wanted: { id: 'wachuneed.mine.wanted', defaultMessage: 'Your wanted ads' },
  shop: { id: 'wachuneed.mine.my_shop', defaultMessage: 'My shop' },
  selling: { id: 'wachuneed.mine.selling', defaultMessage: 'Selling' },
  bought: { id: 'wachuneed.mine.bought', defaultMessage: 'Bought and booked' },
  answered: {
    id: 'wachuneed.mine.answered',
    defaultMessage: 'Answered by you',
  },
  chose: { id: 'wachuneed.mine.chose', defaultMessage: 'People you chose' },
  sold: { id: 'wachuneed.mine.sold', defaultMessage: 'Sold and booked' },
  open: { id: 'wachuneed.shop_edit.title_open', defaultMessage: 'Open a shop' },
  emptyMine: {
    id: 'wachugot.empty',
    defaultMessage: "You haven't listed anything yet",
  },
  emptyMineBody: {
    id: 'wachugot.empty.body',
    defaultMessage: 'What you offer and what you are looking for is kept here.',
  },
  listSomething: {
    id: 'wachuneed.list_something',
    defaultMessage: 'List something',
  },
  postWanted: {
    id: 'wachuneed.post_wanted',
    defaultMessage: 'Post a wanted ad',
  },
});

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({
  heading,
  children,
}) => (
  <section className='wachuneed-shops' aria-label={heading}>
    <h2 className='wachuneed-shops__heading'>{heading}</h2>
    {children}
  </section>
);

export const WachugotListings: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const requests = useWachuneedRequests();
  // undefined while asking.
  const [listings, setListings] = useState<ApiListingJSON[] | undefined>();
  // undefined while asking, null when you have no shop.
  const [shop, setShop] = useState<ApiShopJSON | null | undefined>();

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([
      apiGetWachugotListings(),
      apiGetMyWachuneedShop(),
    ]).then(([mine, own]) => {
      if (cancelled) return undefined;
      setListings(mine.status === 'fulfilled' ? mine.value : []);
      setShop(own.status === 'fulfilled' ? own.value : null);
      return undefined;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenShop = useCallback(() => {
    history.push('/hub/wachuneed/my-shop');
  }, [history]);
  const handleNew = useCallback(() => {
    history.push('/hub/wachuneed/new');
  }, [history]);
  const handleNewWanted = useCallback(() => {
    history.push({ pathname: '/hub/wachuneed/new', search: '?kind=wanted' });
  }, [history]);

  if (!listings || shop === undefined || requests.loading) {
    return <LoadingState label={intl.formatMessage(messages.loading)} />;
  }

  const { asked, mine, busy, confirmDialog, handleAnswer } = requests;
  const waiting = asked.filter((r) => r.state === 'pending');
  const agreed = asked.filter((r) => r.state === 'accepted');
  const chose = agreed.filter((r) => r.pitch);
  const sold = agreed.filter((r) => !r.pitch);
  const answers = mine.filter((r) => r.pitch);
  const working = answers.filter((r) => r.state === 'accepted');
  const answered = answers.filter((r) => r.state !== 'accepted');
  const bought = mine.filter((r) => !r.pitch);
  const wanted = listings.filter((l) => l.kind === 'wanted');
  const selling = listings.filter((l) => l.kind !== 'wanted');

  const nothing =
    waiting.length + answers.length + bought.length + listings.length === 0 &&
    !shop;

  if (nothing) {
    return (
      <EmptyState
        title={intl.formatMessage(messages.emptyMine)}
        body={intl.formatMessage(messages.emptyMineBody)}
        action={
          <KornerActionBar align='center'>
            <KornerPill
              label={intl.formatMessage(messages.listSomething)}
              variant='primary'
              onClick={handleNew}
            />
            <KornerPill
              label={intl.formatMessage(messages.postWanted)}
              onClick={handleNewWanted}
            />
            <KornerPill
              label={intl.formatMessage(messages.open)}
              onClick={handleOpenShop}
            />
          </KornerActionBar>
        }
      />
    );
  }

  return (
    <div className='wachuneed-mine'>
      {confirmDialog}

      <RequestSection
        heading={intl.formatMessage(messages.waiting)}
        requests={waiting}
        side='seller'
        busy={busy}
        onAnswer={handleAnswer}
      />

      <RequestSection
        heading={intl.formatMessage(messages.working)}
        requests={working}
        side='buyer'
        busy={busy}
        onAnswer={handleAnswer}
      />
      <RequestSection
        heading={intl.formatMessage(messages.answered)}
        requests={answered}
        side='buyer'
        busy={busy}
        onAnswer={handleAnswer}
      />

      {wanted.length > 0 && (
        <Section heading={intl.formatMessage(messages.wanted)}>
          <SpaceGrid>
            {wanted.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                markMine={false}
              />
            ))}
          </SpaceGrid>
        </Section>
      )}
      <RequestSection
        heading={intl.formatMessage(messages.chose)}
        requests={chose}
        side='seller'
        busy={busy}
        onAnswer={handleAnswer}
      />

      <Section heading={intl.formatMessage(messages.shop)}>
        {shop ? (
          <SpaceGrid>
            <ShopCard shop={shop} />
          </SpaceGrid>
        ) : (
          <KornerActionBar>
            <KornerPill
              label={intl.formatMessage(messages.open)}
              onClick={handleOpenShop}
            />
          </KornerActionBar>
        )}
      </Section>

      {selling.length > 0 && (
        <Section heading={intl.formatMessage(messages.selling)}>
          <SpaceGrid>
            {selling.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                markMine={false}
              />
            ))}
          </SpaceGrid>
        </Section>
      )}
      <RequestSection
        heading={intl.formatMessage(messages.sold)}
        requests={sold}
        side='seller'
        busy={busy}
        onAnswer={handleAnswer}
      />

      <RequestSection
        heading={intl.formatMessage(messages.bought)}
        requests={bought}
        side='buyer'
        busy={busy}
        onAnswer={handleAnswer}
      />
    </div>
  );
};
