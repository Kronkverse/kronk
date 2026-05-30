import { useMemo } from 'react';

import { LOCATION_TZ } from '../constants';

import { OrbitIcon } from './celestial_icons';
import { getEarthMonth, getDailyObservable } from './earth_calendar';

function currentLocationDate(): { month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: LOCATION_TZ,
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '1', 10);
  return { month: get('month') - 1, day: get('day') };
}

function currentLocationMonthName(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: LOCATION_TZ,
    month: 'long',
  });
}

interface ChipListProps {
  items: string[];
  colorClass: string;
}

const ChipList: React.FC<ChipListProps> = ({ items, colorClass }) => (
  <ul className={`in-flow-earth__chips in-flow-earth__chips--${colorClass}`}>
    {items.map((item) => (
      <li key={item} className='in-flow-earth__chip'>
        {item}
      </li>
    ))}
  </ul>
);

export const EarthStrand: React.FC = () => {
  const { month, day } = useMemo(currentLocationDate, []);
  const monthName = useMemo(currentLocationMonthName, []);
  const data = useMemo(() => getEarthMonth(month), [month]);
  const todayObservable = useMemo(
    () => getDailyObservable(month, day),
    [month, day],
  );

  return (
    <div className='in-flow-earth'>
      <div className='in-flow-earth__header'>
        <OrbitIcon size={20} className='in-flow-earth__header-icon' />
        <span className='in-flow-earth__month'>{monthName}</span>
        <span className='in-flow-earth__season'>{data.season}</span>
      </div>

      <p className='in-flow-earth__observable'>{todayObservable}</p>

      {data.bloom.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>In bloom</div>
          <ChipList items={data.bloom} colorClass='bloom' />
        </div>
      )}

      {data.sow.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>Sow now</div>
          <ChipList items={data.sow} colorClass='sow' />
        </div>
      )}

      {data.harvest.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>Harvest</div>
          <ChipList items={data.harvest} colorClass='harvest' />
        </div>
      )}
    </div>
  );
};
