import { useIntl } from 'react-intl';

import { useLocation } from 'react-router-dom';

import { Stage } from 'mastodon/components/stage';

import { KlotCircleView } from './circle_view';
import { KlotMineView } from './mine_view';
import { klotMessages } from './phases';

// /hub/klot — cycle tracker landing. Chrome (space badge / intro /
// view picker) is Frame-provided (AutoSpaceBadge + AutoSpaceIntro +
// AutoSpaceViewPicker); the component only picks which view to
// render based on the current URL segment, matching the manifest's
// `views:` list.
//
//   /hub/klot          → mine  (default view, first entry in views:)
//   /hub/klot/circle   → circle (inbound projection)

export const Klot: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const isCircle = pathname.endsWith('/circle');

  return (
    <Stage label={intl.formatMessage(klotMessages.title)}>
      <div className='scrollable klot'>
        {isCircle ? <KlotCircleView /> : <KlotMineView />}

        <p className='klot__sovereignty'>
          Your cycle lives with you. Kronk stores only what it must and never
          shares your log — recipients see the phase you allow, nothing beneath
          it.
          <span className='klot__provisional'>provisional</span>
        </p>
      </div>
    </Stage>
  );
};
