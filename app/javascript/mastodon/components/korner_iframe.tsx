import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

// Shared iframe host for korner prototypes shipped from the
// Claude-web design track. Each prototype is a self-contained
// HTML+JS+CSS bundle (typically 300–1100 lines) that gets copied
// into `public/` as `<slug>-preview.html` and rendered inside the
// Kronk chrome via this component.
//
// Real React ports + data wiring happen per-korner in follow-ups;
// this pattern gets the visuals under review reachable inside the
// live app immediately.

interface KornerIframeProps {
  title: string;
  src: string; // absolute path — e.g. '/booth-preview.html'
}

export const KornerIframe: React.FC<KornerIframeProps> = ({ title, src }) => (
  <Stage label={title}>
    <Helmet>
      <title>{title}</title>
      <meta name='robots' content='noindex' />
    </Helmet>
    <iframe title={title} src={src} className='korner-iframe' />
  </Stage>
);
