import { useIntl } from 'react-intl';

import { KornerShell } from 'mastodon/components/korner_shell';

import { KlotCircleView } from './circle_view';
import { KlotMineView } from './mine_view';
import { klotMessages } from './phases';

// /hub/klot — cycle tracker landing. Chrome (space badge / intro /
// view picker) is Frame-provided. The KornerShell owns the Stage
// wrapper and URL-to-view routing; this component just declares the
// views map + the sovereignty footer.
//
// The view keys below MUST agree with `views:` in config/korners/klot.yaml
// — that's the same list AutoSpaceViewPicker uses to render tabs.
//
//   /hub/klot          → mine   (default view, first entry in views:)
//   /hub/klot/circle   → circle (inbound projection)

export const Klot: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();

  return (
    <KornerShell
      slug='klot'
      label={intl.formatMessage(klotMessages.title)}
      className='scrollable klot'
      defaultView='mine'
      views={{
        mine: () => <KlotMineView />,
        circle: () => <KlotCircleView />,
      }}
    >
      <p className='klot__sovereignty'>
        Your cycle lives with you. Kronk stores only what it must and never
        shares your log — recipients see the phase you allow, nothing beneath
        it.
        <span className='klot__provisional'>provisional</span>
      </p>
    </KornerShell>
  );
};
