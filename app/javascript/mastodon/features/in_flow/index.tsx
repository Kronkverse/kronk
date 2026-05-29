import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { DailyIntegration } from './components/daily_integration';
import { DarkStrand } from './components/dark_strand';
import { EarthStrand } from './components/earth_strand';
import { FestivalStrand } from './components/festival_strand';
import { LightStrand } from './components/light_strand';
import { LOCATION_LABEL } from './constants';

interface Props {
  multiColumn?: boolean;
}

export const InFlow: React.FC<Props> = ({ multiColumn }) => (
  <Column>
    <ColumnHeader
      title={planetName('InFlow')}
      icon='public'
      iconComponent={planetIcon('InFlow')}
      multiColumn={multiColumn}
    />

    <div
      className='in-flow scrollable'
      style={{ '--space-color': spaceColor('InFlow') } as React.CSSProperties}
    >
      <header className='in-flow__header'>
        <h1 className='in-flow__title'>In Flow</h1>
        <p className='in-flow__subtitle'>{LOCATION_LABEL}</p>
        <p className='in-flow__tagline'>
          Returning to the rhythm of the Kosmos returns us to the Syntropic
          current of Life itself. Through this we come alive and belong again.
        </p>
      </header>

      <DailyIntegration />

      <section className='in-flow__section'>
        <h2 className='in-flow__section-heading'>— Light —</h2>
        <LightStrand />
      </section>

      <section className='in-flow__section'>
        <h2 className='in-flow__section-heading'>— Dark —</h2>
        <DarkStrand />
      </section>

      <section className='in-flow__section'>
        <h2 className='in-flow__section-heading'>— Earth —</h2>
        <EarthStrand />
      </section>

      <section className='in-flow__section'>
        <h2 className='in-flow__section-heading'>— Season —</h2>
        <FestivalStrand />
      </section>
    </div>
  </Column>
);

export default InFlow;
