import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useLocation, useHistory } from 'react-router-dom';

import CalendarMonthIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import EditIcon from '@/material-icons/400-24px/edit_square.svg?react';
import {
  mountCompose,
  unmountCompose,
  restoreDraft,
} from 'mastodon/actions/compose';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import { useAppDispatch } from 'mastodon/store';

import ComposeFormContainer from '../compose/containers/compose_form_container';

import { UnifiedComposerEventBody } from './event_body';

// One composer, many types. Landing from the Ж Post moon on non-korner
// pages (home / profile / hub landing). A chip row at the top switches
// between types WITHOUT navigating — swapping type just swaps the body
// below. Same page, no scroll reset, no state re-init on unrelated
// state, so a user who starts typing a post can flip to Event, decide
// to go back, and their post text is still there (state is per-type).
//
// Types shipped in v0: Post + Event. Album / Booth Set / Kommons
// Proposal / Wachuneed Listing / Krew / Moment / Nudge come as
// follow-up slices — same UnifiedComposer, add a chip and a body.
//
// Direct per-korner routes (/hub/kalendar/composer, etc.) still work
// unchanged for advanced flows the fast-post body doesn't cover.

type ComposerType = 'post' | 'event';

const messages = defineMessages({
  title: {
    id: 'unified_composer.title',
    defaultMessage: 'Share',
  },
  postTab: {
    id: 'unified_composer.tab.post',
    defaultMessage: 'Post',
  },
  eventTab: {
    id: 'unified_composer.tab.event',
    defaultMessage: 'Event',
  },
});

const TYPE_FROM_QUERY = (search: string): ComposerType => {
  const t = new URLSearchParams(search).get('type');
  return t === 'event' ? 'event' : 'post';
};

const UnifiedComposer: React.FC<{ multiColumn?: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const history = useHistory();
  const [type, setType] = useState<ComposerType>(() =>
    TYPE_FROM_QUERY(location.search),
  );

  // Same lifecycle the classic Compose page ran — mount + restore
  // draft when the composer opens, unmount when we leave. The Post
  // body reads its state from the Redux compose slice.
  useEffect(() => {
    dispatch(mountCompose());
    dispatch(restoreDraft());
    return () => {
      dispatch(unmountCompose());
    };
  }, [dispatch]);

  const setPost = useCallback(() => {
    setType('post');
    history.replace('/publish');
  }, [history]);

  const setEvent = useCallback(() => {
    setType('event');
    history.replace('/publish?type=event');
  }, [history]);

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      <ColumnHeader
        icon='pencil'
        iconComponent={EditIcon}
        title={intl.formatMessage(messages.title)}
        multiColumn={multiColumn ?? false}
        showBackButton
      />

      <div className='scrollable unified-composer'>
        <nav
          className='unified-composer__tabs'
          aria-label={intl.formatMessage(messages.title)}
        >
          <button
            type='button'
            aria-pressed={type === 'post'}
            className={`unified-composer__tab${type === 'post' ? ' unified-composer__tab--active' : ''}`}
            onClick={setPost}
          >
            <Icon
              id='post'
              icon={ChatIcon}
              className='unified-composer__tab-icon'
            />
            {intl.formatMessage(messages.postTab)}
          </button>
          <button
            type='button'
            aria-pressed={type === 'event'}
            className={`unified-composer__tab${type === 'event' ? ' unified-composer__tab--active' : ''}`}
            onClick={setEvent}
          >
            <Icon
              id='event'
              icon={CalendarMonthIcon}
              className='unified-composer__tab-icon'
            />
            {intl.formatMessage(messages.eventTab)}
          </button>
        </nav>

        <div className='unified-composer__body'>
          {type === 'post' && <ComposeFormContainer />}
          {type === 'event' && <UnifiedComposerEventBody />}
        </div>
      </div>

      <Helmet>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default UnifiedComposer;
