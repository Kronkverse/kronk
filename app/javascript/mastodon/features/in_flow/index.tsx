import { useState } from 'react';

import { Helmet } from 'react-helmet';

import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { DarkStrand } from './components/dark_strand';
import { EarthStrand } from './components/earth_strand';
import { FestivalStrand } from './components/festival_strand';
import { LightStrand } from './components/light_strand';

type Strand = 'light' | 'dark' | 'earth' | 'festival';

const STRANDS: { id: Strand; label: string; emoji: string }[] = [
  { id: 'light', label: 'Light', emoji: '☀️' },
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'earth', label: 'Earth', emoji: '🌿' },
  { id: 'festival', label: 'Festival', emoji: '🔥' },
];

interface Props {
  multiColumn?: boolean;
}

export const InFlow: React.FC<Props> = ({ multiColumn }) => {
  const [activeStrand, setActiveStrand] = useState<Strand>('light');

  const handleStrandClick = (id: Strand) => () => {
    setActiveStrand(id);
  };

  return (
    <Column>
      <ColumnHeader
        title={planetName('InFlow')}
        icon='public'
        iconComponent={planetIcon('InFlow')}
        multiColumn={multiColumn}
      />

      <Helmet>
        <title>In Flow</title>
      </Helmet>

      <div
        className='in-flow-tab__wrapper'
        style={{ '--space-color': spaceColor('InFlow') } as React.CSSProperties}
      >
        <div className='in-flow-tab__strand-tabs'>
          {STRANDS.map(({ id, label, emoji }) => (
            <button
              key={id}
              className={`in-flow-tab__strand-btn${activeStrand === id ? ' in-flow-tab__strand-btn--active' : ''}`}
              onClick={handleStrandClick(id)}
            >
              <span className='in-flow-tab__strand-emoji'>{emoji}</span>
              <span className='in-flow-tab__strand-label'>{label}</span>
            </button>
          ))}
        </div>

        <div className='in-flow-tab__content scrollable'>
          {activeStrand === 'light' && <LightStrand />}
          {activeStrand === 'dark' && <DarkStrand />}
          {activeStrand === 'earth' && <EarthStrand />}
          {activeStrand === 'festival' && <FestivalStrand />}
        </div>
      </div>
    </Column>
  );
};

export default InFlow;
