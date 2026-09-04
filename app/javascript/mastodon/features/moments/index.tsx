// Moments — the /hub/moments korner. Two sections over the same
// reach-ladder-gated collection: "Now" (active, still inside the 24h
// window — mirrors the top-of-Home strip) and "Log" (the permanent
// archive of Moments that have since expired).
//
// Compose is not an inline button on the page — every korner surface
// exposes exactly one floating bubble (`<ComposeFab>`) that routes to
// `/hub/<slug>/composer`. The composer itself lives in `<ComposeShell>`
// (Tal 2026-08-09: "compose button contained to the floating bubble").
//
// Sits inside KornerShell so AutoSpaceBadge + AutoSpaceHeader do the
// chrome (Standard L11).

import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useHistory, useLocation } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import { ComposeFab } from 'mastodon/components/compose_fab';
import { KornerShell } from 'mastodon/components/korner_shell';

import { MomentsComposer } from './composer';
import { MomentsGrid } from './grid';

const messages = defineMessages({
  fab: {
    id: 'moments.fab.label',
    defaultMessage: 'Share a Moment',
  },
});

const COMPOSER_PATH = '/hub/moments/composer';
const LANDING_PATH = '/hub/moments';

const YoursView = () => {
  const intl = useIntl();
  const { pathname } = useLocation();
  const history = useHistory();
  // Route drives open/close so the FAB is a plain `<Link>` — keyboard,
  // middle-click, back-button all work natively. Auto-open on the
  // /composer path; close routes back to /hub/moments so refresh
  // doesn't reopen.
  const composerOpen = pathname === COMPOSER_PATH;
  const [refreshTick, setRefreshTick] = useState(0);

  const closeComposer = useCallback(() => {
    history.replace(LANDING_PATH);
  }, [history]);

  const onPosted = useCallback(() => {
    history.replace(LANDING_PATH);
    setRefreshTick((n) => n + 1);
  }, [history]);

  return (
    <div className='moments'>
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
              defaultMessage='Your Moments, kept for you'
            />
          </span>
        </h2>
        <MomentsGrid refreshTick={refreshTick} filter='log' />
      </section>

      {composerOpen && (
        <MomentsComposer onClose={closeComposer} onPosted={onPosted} />
      )}

      {/* Every korner surface that supports posting gets one floating
          compose bubble in a consistent bottom-right position. Hidden
          while the composer itself is open so it doesn't sit under
          the shell. */}
      {!composerOpen && (
        <ComposeFab
          to={COMPOSER_PATH}
          label={intl.formatMessage(messages.fab)}
          icon={AddIcon}
          iconId='add'
        />
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
