import { defineMessages, useIntl } from 'react-intl';

import { EmptyState } from './empty_state';

// What a full map shows when the browser has WebGL turned off, in place of
// the map (see `supportsWebGL` in features/map_v2/basemap.ts and
// docs/spaces/map.md, "Without WebGL").

const messages = defineMessages({
  title: {
    id: 'map.needs_webgl.title',
    defaultMessage: 'This map needs WebGL, which this browser has turned off.',
  },
});

export const MapNeedsWebGL: React.FC<{ body?: React.ReactNode }> = ({
  body,
}) => {
  const intl = useIntl();
  return <EmptyState title={intl.formatMessage(messages.title)} body={body} />;
};
