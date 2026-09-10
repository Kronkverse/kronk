import { KornerShell } from 'mastodon/components/korner_shell';

// Kronikles landing — scaffold placeholder. The korner is registered
// via config/korners/kronikles.yaml with `enforced: false` +
// `lifecycle: soon` so it appears on the Hub grid as a coming-soon
// tile. Real composer + reader land later; for now the /hub/kronikles
// route just resolves to a short lede so the tile has somewhere to go
// when tapped.

const Landing: React.FC = () => (
  <div className='kronikles kronikles__landing'>
    <p>
      A house for long-form writing — essays, stories, journals, letters. Coming
      soon.
    </p>
  </div>
);

export const Kronikles: React.FC<{ multiColumn?: boolean }> = () => (
  <KornerShell
    slug='kronikles'
    label='Kronikles'
    className='kronikles'
    defaultView='default'
    views={{ default: () => <Landing /> }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components expects a default export
export default Kronikles;
