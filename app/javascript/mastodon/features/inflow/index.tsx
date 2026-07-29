import { Stage } from 'mastodon/components/stage';

import { DailyIntegration } from './components/daily_integration';
import { DarkStrand } from './components/dark_strand';
import { EarthStrand } from './components/earth_strand';
import { FestivalStrand } from './components/festival_strand';
import { LightStrand } from './components/light_strand';
import { LOCATION_LABEL } from './constants';

// InFlow — the native feed view. A unified single scroll (the four strands
// woven together rather than tabbed, per docs/spaces/inflow.md): today's
// synthesis up top, then Light, Dark, Soil and Season in one flow. All
// client-computed from the celestial engine except the daily ecological note
// (EarthStrand fetches /api/v1/inflow/observation). Replaces the iframe
// prototype that /hub/inflow used to show.

interface Props {
  multiColumn?: boolean;
}

export const Inflow: React.FC<Props> = () => (
  <Stage label='Inflow'>
    <div className='in-flow scrollable'>
      <header className='in-flow__header'>
        <h1 className='in-flow__title'>Inflow</h1>
        <p className='in-flow__subtitle'>{LOCATION_LABEL}</p>
        <p className='in-flow__tagline'>
          In Flow is a way to attune to the Kosmos occurring around us, as it
          occurs within us. This relationship is ancient. The more we align with
          the cycles of light, dark, soil and season, the more we are{' '}
          <em>In Flow</em> — with ourselves, with each other, and with the
          greater fractal of Life.
        </p>
      </header>

      <DailyIntegration />

      <div className='in-flow__strands'>
        <section className='in-flow__strand' aria-label='Light'>
          <h2 className='in-flow__strand-heading'>Light</h2>
          <LightStrand />
        </section>

        <section className='in-flow__strand' aria-label='Dark'>
          <h2 className='in-flow__strand-heading'>Dark</h2>
          <DarkStrand />
        </section>

        <section className='in-flow__strand' aria-label='Soil'>
          <h2 className='in-flow__strand-heading'>Soil</h2>
          <EarthStrand />
        </section>

        <section className='in-flow__strand' aria-label='Season'>
          <h2 className='in-flow__strand-heading'>Season</h2>
          <FestivalStrand />
        </section>
      </div>
    </div>
  </Stage>
);
