import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type {
  ApiBrandJSON,
  BrandCategory,
} from 'mastodon/api/wachuneed_brands';
import { SpaceCard } from 'mastodon/components/space_grid';

// One brand as a tile of the standard grid (`<SpaceCard>`), in Brands and
// under Proposed: its picture (its first letter when it has none), its
// name, how many back it, and its category as the chip. A brand still
// gathering backers says how many of the backers it needs it has.

export const brandCategoryMessages: Record<BrandCategory, MessageDescriptor> =
  defineMessages({
    clothing: {
      id: 'wachuneed.brands.category.clothing',
      defaultMessage: 'Clothing',
    },
    art: { id: 'wachuneed.brands.category.art', defaultMessage: 'Art' },
    food: {
      id: 'wachuneed.brands.category.food',
      defaultMessage: 'Food and drink',
    },
    home: {
      id: 'wachuneed.brands.category.home',
      defaultMessage: 'Home and garden',
    },
    wellbeing: {
      id: 'wachuneed.brands.category.wellbeing',
      defaultMessage: 'Health and body',
    },
    outdoors: {
      id: 'wachuneed.brands.category.outdoors',
      defaultMessage: 'Outdoors',
    },
    other: {
      id: 'wachuneed.brands.category.other',
      defaultMessage: 'Something else',
    },
  });

const messages = defineMessages({
  backers: {
    id: 'wachuneed.brands.backers',
    defaultMessage: '{count, plural, one {# backer} other {# backers}}',
  },
  gathering: {
    id: 'wachuneed.brands.gathering',
    defaultMessage: '{count} of {needed} backers',
  },
});

export const BrandCard: React.FC<{ brand: ApiBrandJSON }> = ({ brand }) => {
  const intl = useIntl();

  return (
    <SpaceCard
      to={`/hub/wachuneed/brands/${brand.id}`}
      image={brand.picture_url}
      placeholder={brand.name.charAt(0).toUpperCase()}
      title={brand.name}
      meta={
        brand.listed
          ? intl.formatMessage(messages.backers, { count: brand.backers_count })
          : intl.formatMessage(messages.gathering, {
              count: brand.backers_count,
              needed: brand.backers_to_list,
            })
      }
      tag={
        brand.category
          ? intl.formatMessage(brandCategoryMessages[brand.category])
          : undefined
      }
    />
  );
};
