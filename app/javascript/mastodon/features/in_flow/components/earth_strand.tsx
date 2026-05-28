import { useMemo } from 'react';

import { getEarthMonth } from './earth_calendar';

const SYDNEY_TZ = 'Australia/Sydney';

function currentSydneyMonth(): number {
  const fmt = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  return parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10) - 1;
}

function currentSydneyMonthName(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: SYDNEY_TZ,
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
  const month = useMemo(currentSydneyMonth, []);
  const monthName = useMemo(currentSydneyMonthName, []);
  const data = useMemo(() => getEarthMonth(month), [month]);

  return (
    <div className='in-flow-earth'>
      <div className='in-flow-earth__header'>
        <span className='in-flow-earth__month'>{monthName}</span>
        <span className='in-flow-earth__season'>{data.season}</span>
      </div>

      <p className='in-flow-earth__naturalist'>{data.naturalist}</p>

      {data.bloom.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>🌸 In bloom</div>
          <ChipList items={data.bloom} colorClass='bloom' />
        </div>
      )}

      {data.sow.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>🌱 Sow now</div>
          <ChipList items={data.sow} colorClass='sow' />
        </div>
      )}

      {data.harvest.length > 0 && (
        <div className='in-flow-earth__section'>
          <div className='in-flow-earth__section-label'>🧺 Harvest</div>
          <ChipList items={data.harvest} colorClass='harvest' />
        </div>
      )}
    </div>
  );
};
