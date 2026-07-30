// Moments — the /hub/moments korner. Two sections over the same
// reach-ladder-gated collection: "Now" (active, still inside the 24h
// window — mirrors the top-of-Home strip) and "Log" (the permanent
// archive of Moments that have since expired). A compose entry point
// opens the inline composer.
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

      <section className='moments__section'>
        <h2 className='moments__section-heading'>
          <FormattedMessage id='moments.section.now' defaultMessage='Now' />
          <span className='moments__section-sub'>
            <FormattedMessage
              id='moments.section.now_sub'
              defaultMessage='Live for 24 hours'
            />
          </span>
        </h2>
        <MomentsGrid refreshTick={refreshTick} filter='active' />
      </section>

      <section className='moments__section moments__section--log'>
        <h2 className='moments__section-heading'>
          <FormattedMessage id='moments.section.log' defaultMessage='Log' />
          <span className='moments__section-sub'>
            <FormattedMessage
              id='moments.section.log_sub'
              defaultMessage='Past Moments, kept for keeps'
            />
          </span>
        </h2>
        <MomentsGrid refreshTick={refreshTick} filter='log' />
      </section>

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
