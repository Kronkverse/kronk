// Mates tab — the per-member timeline view at /@user/mates. Stub
// pending its five design unresolveds (visibility scope, mate model,
// tombstoned members, date semantics, empty states — see the timeline
// brief attached to Kommons proposal "Mates" #116990859270976043).
//
// This route + shell lands now so the profile navigation is complete;
// the timeline internals ship in a follow-up PR once the unresolveds
// settle. Frame-adherent: Stage owns the layout, no local <h1>, tab
// picker deferred until the sibling views exist.

import { FormattedMessage } from 'react-intl';

import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';

const MatesTab = () => (
  <Column bindToDocument>
    <ColumnBackButton />
    <div className='mates-tab'>
      <div className='mates-tab__card'>
        <h2 className='mates-tab__title'>
          <FormattedMessage id='mates_tab.title' defaultMessage='Mates' />
        </h2>
        <p className='mates-tab__lede'>
          <FormattedMessage
            id='mates_tab.lede'
            defaultMessage='Your community, drawn as a timeline. Mates above the line, the people you invited below it, invite chains behind either on request.'
          />
        </p>
        <p className='mates-tab__note'>
          <FormattedMessage
            id='mates_tab.coming_next'
            defaultMessage='Coming next — the timeline view lands after its design decisions are settled (visibility scope, mate model, tombstoned members).'
          />
        </p>
      </div>
    </div>
  </Column>
);

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export
export default MatesTab;
