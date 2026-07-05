import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';

import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, spaceColor } from 'mastodon/planets';

import { ComposeForm } from './components/compose_form';
import { DoorsLanding } from './components/doors_landing';
import { SectionView } from './components/section_view';
import type { MarketplaceCategory } from './types';

const messages = defineMessages({
  heading: { id: 'marketplace.title', defaultMessage: 'Marketplace' },
});

const VALID_SECTIONS: MarketplaceCategory[] = [
  'creation',
  'marketplace',
  'service',
];

// Route param uses the plural english word ("creations"/"marketplace"/"services")
// for a nicer URL. Map to the enum used in the DB / API.
const SECTION_ALIAS: Record<string, MarketplaceCategory> = {
  creations: 'creation',
  marketplace: 'marketplace',
  services: 'service',
};

const Marketplace: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const params = useParams<{ section?: string }>();

  const rawSection = params.section;
  const isCompose = rawSection === 'new';
  const category = rawSection ? SECTION_ALIAS[rawSection] : undefined;
  const isValidSection = category && VALID_SECTIONS.includes(category);

  return (
    <Column bindToDocument={!multiColumn}>
      <ColumnHeader
        icon='inventory_2'
        iconComponent={planetIcon('Marketplace')}
        title={intl.formatMessage(messages.heading)}
        multiColumn={multiColumn}
      />

      <div
        className='marketplace-page scrollable'
        style={
          { '--space-color': spaceColor('Marketplace') } as React.CSSProperties
        }
      >
        {isCompose ? (
          <ComposeForm />
        ) : isValidSection ? (
          <SectionView category={category} />
        ) : (
          <DoorsLanding />
        )}
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

export default Marketplace;
