import { KornerShell } from 'mastodon/components/korner_shell';

// Cinema landing — scaffold placeholder. The korner is registered via
// config/korners/cinema.yaml with `enforced: false` +
// `lifecycle: soon` so it appears on the Hub grid as a coming-soon
// tile. Real composer + viewer land later; for now the /hub/cinema
// route just resolves to a short lede so the tile has somewhere to go
// when tapped.

const Landing: React.FC = () => (
  <div className='cinema cinema__landing'>
    <p>
      A house for short films — original work, from title card to end frame.
      Coming soon.
    </p>
  </div>
);

export const Cinema: React.FC<{ multiColumn?: boolean }> = () => (
  <KornerShell
    slug='cinema'
    label='Cinema'
    className='cinema'
    defaultView='default'
    views={{ default: () => <Landing /> }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components expects a default export
export default Cinema;
