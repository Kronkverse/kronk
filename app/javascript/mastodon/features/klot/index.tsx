import { useCallback, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { Stage } from 'mastodon/components/stage';

import { KlotCircleView } from './circle_view';
import { KlotMineView } from './mine_view';
import { klotMessages } from './phases';

// /hub/klot — cycle tracker landing. Two views (Mine + Circle) live
// on the same route, toggled by a segmented pill. Ports
// tides_prototype.html to native React; consumes /api/v1/klot/*
// (shipped in alpha.222). KRONK_TIDES §Consent invariants live
// server-side — the client only reads what the API deigns to return.

type View = 'mine' | 'circle';

export const Klot: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const [view, setView] = useState<View>('mine');

  const handleMine = useCallback(() => {
    setView('mine');
  }, []);
  const handleCircle = useCallback(() => {
    setView('circle');
  }, []);

  return (
    <Stage label={intl.formatMessage(klotMessages.title)}>
      <div className='scrollable klot'>
        <header className='klot__hero'>
          <h1 className='klot__title'>
            <FormattedMessage {...klotMessages.title} />
          </h1>
          <p className='klot__lede'>
            <FormattedMessage {...klotMessages.lede} />
          </p>
        </header>

        <div
          className='klot__tabs'
          role='tablist'
          aria-label={intl.formatMessage(klotMessages.title)}
        >
          <button
            type='button'
            role='tab'
            aria-selected={view === 'mine'}
            onClick={handleMine}
            className={`klot__tab ${view === 'mine' ? 'klot__tab--active' : ''}`}
          >
            <FormattedMessage {...klotMessages.tabMine} />
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={view === 'circle'}
            onClick={handleCircle}
            className={`klot__tab ${view === 'circle' ? 'klot__tab--active' : ''}`}
          >
            <FormattedMessage {...klotMessages.tabCircle} />
          </button>
        </div>

        {view === 'mine' ? <KlotMineView /> : <KlotCircleView />}

        <p className='klot__sovereignty'>
          <FormattedMessage
            id='klot.sovereignty'
            defaultMessage='Your cycle lives with you. Kronk stores only what it must and never shares your log — recipients see the phase you allow, nothing beneath it.'
          />
          <span className='klot__provisional'>provisional</span>
        </p>
      </div>
    </Stage>
  );
};
