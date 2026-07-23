import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

// The Kalendar (Kalendar Rebuild — Kommons proposal
// #116969253949249128). The Spiral IS the Kalendar — as of alpha.201
// the classic Events list retired; /hub/kalendar renders this
// component. Individual /hub/kalendar/:id event detail pages remain
// (EventDetail) until the Spiral wires day-picking into them.
//
// The prototype is a self-contained HTML+JS+CSS bundle (1100+ lines,
// hand-drawn spiral positioning, moon-phase maths, in-flow sky data,
// mock EVENTS array). We ship it as-is at
// public/kalendar-spiral-preview.html and iframe it inside the Kronk
// chrome. The Frame's space badge sits over top-left; only the spiral
// canvas lives inside the iframe.
//
// Follow-up: port the prototype into a real React component and wire
// real Event / EventRsvp / celestial data (currently reads from an
// inline EVENTS mock).

const messages = defineMessages({
  title: { id: 'kalendar_spiral.title', defaultMessage: '₭alendar' },
});

const KalendarSpiral: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const title = intl.formatMessage(messages.title);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
        <meta name='robots' content='noindex' />
      </Helmet>

      <iframe
        title={title}
        src='/kalendar-spiral-preview.html'
        className='kalendar-spiral'
      />
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default KalendarSpiral;
