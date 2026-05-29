import { useCallback, useState } from 'react';

import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { planetIcon, planetName, spaceColor } from 'mastodon/planets';

import { DarkStrand } from './components/dark_strand';
import { EarthStrand } from './components/earth_strand';
import { FestivalStrand } from './components/festival_strand';
import { LightStrand } from './components/light_strand';
import { LOCATION_LABEL } from './constants';

interface Props {
  multiColumn?: boolean;
}

type StrandTab = 'light' | 'dark' | 'soil' | 'season';

const STRAND_TABS: StrandTab[] = ['light', 'dark', 'soil', 'season'];

interface StrandTabButtonProps {
  tab: StrandTab;
  active: boolean;
  onSelect: (tab: StrandTab) => void;
}

const StrandTabButton: React.FC<StrandTabButtonProps> = ({
  tab,
  active,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(tab);
  }, [tab, onSelect]);
  return (
    <button
      type='button'
      className={`in-flow__strand-tab ${active ? 'in-flow__strand-tab--active' : ''}`}
      onClick={handleClick}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
    </button>
  );
};

export const InFlow: React.FC<Props> = ({ multiColumn }) => {
  const [activeTab, setActiveTab] = useState<StrandTab>('light');

  return (
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
            In Flow is a way to attune to the Kosmos occurring us, and as it
            occurs within us. This relationship is ancient. The more we align
            with the cycles of light, dark, soil and season, the more we are{' '}
            <em>In Flow</em> — with ourselves, with each other, and with the
            greater fractal of Life.
          </p>
        </header>

        <div className='in-flow__strand-tabs'>
          {STRAND_TABS.map((tab) => (
            <StrandTabButton
              key={tab}
              tab={tab}
              active={activeTab === tab}
              onSelect={setActiveTab}
            />
          ))}
        </div>

        <div className='in-flow__strand-content'>
          {activeTab === 'light' && (
            <div className='in-flow__strand-panel' key='light'>
              <LightStrand />
            </div>
          )}
          {activeTab === 'dark' && (
            <div className='in-flow__strand-panel' key='dark'>
              <DarkStrand />
            </div>
          )}
          {activeTab === 'soil' && (
            <div className='in-flow__strand-panel' key='soil'>
              <EarthStrand />
            </div>
          )}
          {activeTab === 'season' && (
            <div className='in-flow__strand-panel' key='season'>
              <FestivalStrand />
            </div>
          )}
        </div>
      </div>
    </Column>
  );
};

export default InFlow;
