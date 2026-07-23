import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import { Stage } from 'mastodon/components/stage';

// The Spiral view (Kalendar Rebuild — Kommons proposal
// #116969253949249128). First step: mount the interactive prototype
// authored in the Claude-web track as a preview view alongside the
// classic list view (SLUG_TO_VIEWS[kalendar]).
//
// The prototype is a self-contained HTML+JS+CSS bundle (1100+ lines,
// hand-drawn spiral positioning, moon-phase maths, in-flow sky data,
// mock EVENTS array). Rather than port line-by-line — which changes
// the visual under review — we ship it as-is at
// public/kalendar-spiral-preview.html and iframe it inside the Kronk
// chrome. Space badge + view picker come from the Frame; only the
// spiral canvas lives inside the iframe.
//
// Follow-up (task 2 of the proposal): port the prototype into a real
// React component, wire real Event / EventRsvp / celestial data,
// replace the classic /hub/kalendar list view.

const messages = defineMessages({
  title: { id: 'kalendar_spiral.title', defaultMessage: '₭alendar — Spiral' },
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
