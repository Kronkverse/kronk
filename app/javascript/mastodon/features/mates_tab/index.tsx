// Mates tab — /@user/mates. The subject's community drawn as a
// time-anchored timeline: main line, mates above, invitees below,
// inviter at the head. Clicking a tile makes that member the new
// subject; the view rebuilds around their line.
//
// Design source: KRONK_KOMMUNITY.md attached to Kommons proposal
// "Mates" #116990859270976043. See docs/spaces/mates_tab.md for
// what's shipped in this pass vs. deferred (branches, lineage
// trace, sub-lane packing, search).

import { useParams } from 'react-router-dom';

import { Column } from 'mastodon/components/column';
import { ColumnBackButton } from 'mastodon/components/column_back_button';

import { MatesTimeline } from './timeline';

const MatesTab = () => {
  const { acct } = useParams<{ acct: string }>();

  return (
    <Column bindToDocument>
      <ColumnBackButton />
      <div className='mates-tab'>
        <MatesTimeline viewerHandle={acct} />
      </div>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components.js expects a default export
export default MatesTab;
