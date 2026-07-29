// Moments — the /hub/moments korner. First-pass v1: viewer's own
// active moments (subject filter is a next-slice concern) + a compose
// entry point that opens the inline composer. Full-screen viewer,
// Home strip, and cross-korner attach flows all follow.
//
// Sits inside KornerShell so AutoSpaceBadge + AutoSpaceHeader do the
// chrome (Standard L11).

import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { KornerShell } from 'mastodon/components/korner_shell';

import { MomentsComposer } from './composer';
import { MomentsGrid } from './grid';

const YoursView = () => {
  const [showComposer, setShowComposer] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const openComposer = useCallback(() => {
    setShowComposer(true);
  }, []);
  const closeComposer = useCallback(() => {
    setShowComposer(false);
  }, []);
  const onPosted = useCallback(() => {
    setShowComposer(false);
    setRefreshTick((n) => n + 1);
  }, []);

  return (
    <div className='moments'>
      <div className='moments__actions'>
        <button
          type='button'
          className='moments__compose-cta'
          onClick={openComposer}
        >
          <FormattedMessage
            id='moments.compose_cta'
            defaultMessage='+ Share a Moment'
          />
        </button>
      </div>
      <MomentsGrid refreshTick={refreshTick} />
      {showComposer && (
        <MomentsComposer onClose={closeComposer} onPosted={onPosted} />
      )}
    </div>
  );
};

export const Moments = () => (
  <KornerShell
    slug='moments'
    label='Moments'
    className='moments-shell'
    defaultView='yours'
    views={{ yours: YoursView }}
  />
);

// eslint-disable-next-line import/no-default-export -- async-components expects a default export
export default Moments;
