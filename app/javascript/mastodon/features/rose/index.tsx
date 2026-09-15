import { KornerShell } from 'mastodon/components/korner_shell';

import { RoseStackView } from './stack_view';

// Rose — /hub/rose. One view: the roses you were given today.
//
// No composer route and no views: list in the manifest, because a rose
// is sent from a person's profile and there is nothing here to switch
// between. Title and tagline come from the Frame (Standard L11).

export const Rose: React.FC<{ multiColumn?: boolean }> = () => (
  <KornerShell
    slug='rose'
    label='Rose'
    className='scrollable rose'
    defaultView='stack'
    views={{
      stack: () => <RoseStackView />,
    }}
  />
);
