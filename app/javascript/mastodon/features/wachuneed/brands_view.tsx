import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import { apiGetWachuneedBrands } from 'mastodon/api/wachuneed_brands';
import type { ApiBrandJSON, BrandsStatus } from 'mastodon/api/wachuneed_brands';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';

import { BrandCard } from './brand_card';
import { BrandComposer } from './brand_composer';

// /hub/wachuneed/brands — brands whose mission members back
// (docs/spaces/wachuneed.md, Brands), as tiles in the standard grid
// (`<SpaceGrid>`, one `<BrandCard>` each). Two lists, chosen by the
// address: Backed (the default, brands with the backers they need, A to
// Z) and Proposed (`?show=proposed`, those still gathering backers, newest
// first, so people can back them).
//
// + on the Ж menu here is Propose a brand. The composer opens over the
// list at `?brand=new`; a brand proposed opens its page.

const BRANDS_PATH = '/hub/wachuneed/brands';

const messages = defineMessages({
  loading: {
    id: 'wachuneed.brands.loading',
    defaultMessage: 'Loading brands…',
  },
  backed: { id: 'wachuneed.brands.show.backed', defaultMessage: 'Backed' },
  proposed: {
    id: 'wachuneed.brands.show.proposed',
    defaultMessage: 'Proposed',
  },
  lists: { id: 'wachuneed.brands.lists', defaultMessage: 'Which brands' },
  propose: {
    id: 'wachuneed.brands.propose',
    defaultMessage: 'Propose a brand',
  },
  empty: {
    id: 'wachuneed.brands.empty',
    defaultMessage: 'No brands backed yet',
  },
  emptyBody: {
    id: 'wachuneed.brands.empty.body',
    defaultMessage:
      'Brands whose mission members respect show here once enough members back them. See what is proposed, or propose one.',
  },
  emptyProposed: {
    id: 'wachuneed.brands.empty_proposed',
    defaultMessage: 'Nothing waiting for backers',
  },
  emptyProposedBody: {
    id: 'wachuneed.brands.empty_proposed.body',
    defaultMessage:
      'Know a brand doing right by people and the planet? Propose it, and say why we should back it.',
  },
});

export const WachuneedBrands: React.FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const { search } = useLocation();
  const query = new URLSearchParams(search);
  const status: BrandsStatus =
    query.get('show') === 'proposed' ? 'proposed' : 'listed';
  const composing = query.get('brand') === 'new';

  const [brands, setBrands] = useState<ApiBrandJSON[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiGetWachuneedBrands(status)
      .then((data) => {
        if (!cancelled) setBrands(data);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setBrands([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  // A location object, not a string: this app's history.push drops a
  // `?query` given as a string.
  const showList = useCallback(
    (show: BrandsStatus) => {
      history.push({
        pathname: BRANDS_PATH,
        search: show === 'proposed' ? '?show=proposed' : '',
      });
    },
    [history],
  );
  const handleBacked = useCallback(() => {
    showList('listed');
  }, [showList]);
  const handleProposed = useCallback(() => {
    showList('proposed');
  }, [showList]);

  const handlePropose = useCallback(() => {
    const next = new URLSearchParams(search);
    next.set('brand', 'new');
    history.push({ pathname: BRANDS_PATH, search: `?${next.toString()}` });
  }, [history, search]);
  const handleCancel = useCallback(() => {
    const next = new URLSearchParams(search);
    next.delete('brand');
    const rest = next.toString();
    history.replace({ pathname: BRANDS_PATH, search: rest ? `?${rest}` : '' });
  }, [history, search]);
  const handleSaved = useCallback(
    (brand: ApiBrandJSON | null) => {
      if (brand) history.replace(`${BRANDS_PATH}/${brand.id}`);
    },
    [history],
  );

  const proposeLabel = intl.formatMessage(messages.propose);
  useRegisterPageAction(
    { key: 'post', label: proposeLabel, icon: AddIcon, iconId: 'add' },
    handlePropose,
    true,
  );

  const proposeButton = (
    <KornerPill
      label={proposeLabel}
      variant='primary'
      onClick={handlePropose}
    />
  );

  return (
    <>
      <nav aria-label={intl.formatMessage(messages.lists)}>
        <KornerActionBar align='center'>
          <KornerPill
            label={intl.formatMessage(messages.backed)}
            active={status === 'listed'}
            onClick={handleBacked}
          />
          <KornerPill
            label={intl.formatMessage(messages.proposed)}
            active={status === 'proposed'}
            onClick={handleProposed}
          />
        </KornerActionBar>
      </nav>

      {loading && <LoadingState label={intl.formatMessage(messages.loading)} />}

      {!loading && brands.length === 0 && (
        <EmptyState
          title={intl.formatMessage(
            status === 'proposed' ? messages.emptyProposed : messages.empty,
          )}
          body={intl.formatMessage(
            status === 'proposed'
              ? messages.emptyProposedBody
              : messages.emptyBody,
          )}
          action={proposeButton}
        />
      )}

      {!loading && brands.length > 0 && (
        <SpaceGrid>
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </SpaceGrid>
      )}

      {composing && (
        <BrandComposer onCancel={handleCancel} onSaved={handleSaved} />
      )}
    </>
  );
};
