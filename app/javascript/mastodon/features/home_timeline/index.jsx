import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { connect } from 'react-redux';

import CampaignIcon from '@/material-icons/400-24px/campaign.svg?react';
import HomeIcon from '@/material-icons/400-24px/home-fill.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { fetchAnnouncements, toggleShowAnnouncements } from 'mastodon/actions/announcements';
import { IconWithBadge } from 'mastodon/components/icon_with_badge';
import { SymbolLogo } from 'mastodon/components/logo';
import { NotSignedInIndicator } from 'mastodon/components/not_signed_in_indicator';
import { VeilScene } from 'mastodon/features/inflow/veil_scene';
import { MomentsStrip } from 'mastodon/features/moments/home_strip';
import { withBreakpoint } from 'mastodon/features/ui/hooks/useBreakpoint';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { criticalUpdatesPending } from 'mastodon/initial_state';

import { addColumn, removeColumn, moveColumn } from '../../actions/columns';
import { expandHomeTimeline, expandCommunityTimeline } from '../../actions/timelines';
import Column from '../../components/column';
import ColumnHeader from '../../components/column_header';
import StatusListContainer from '../ui/containers/status_list_container';

import { Announcements } from './components/announcements';
import { ColumnSettings } from './components/column_settings';
import { CriticalUpdateBanner } from './components/critical_update_banner';
import { HomeStatusBox } from './components/home_status_box';
import { LiveBanner } from './components/live_banner';

const messages = defineMessages({
  title: { id: 'column.home', defaultMessage: 'Home' },
  show_announcements: { id: 'home.show_announcements', defaultMessage: 'Show announcements' },
  hide_announcements: { id: 'home.hide_announcements', defaultMessage: 'Hide announcements' },
  feedSettings: { id: 'home.feed_settings', defaultMessage: 'Feed settings' },
});

const mapStateToProps = state => ({
  hasUnread: state.getIn(['timelines', 'home', 'unread']) > 0,
  isPartial: state.getIn(['timelines', 'home', 'isPartial']),
  hasAnnouncements: !state.getIn(['announcements', 'items']).isEmpty(),
  unreadAnnouncements: state.getIn(['announcements', 'items']).count(item => !item.get('read')),
  showAnnouncements: state.getIn(['announcements', 'show']),
  // Tuned out of InFlow → the veil is not inserted into the feed (the
  // korner tune-in gate). The /hub/inflow page itself stays reachable.
  inflowTunedOut: state.korners?.inflow?.tuned_in === false,
});

class HomeTimeline extends PureComponent {
  static propTypes = {
    identity: identityContextPropShape,
    dispatch: PropTypes.func.isRequired,
    intl: PropTypes.object.isRequired,
    hasUnread: PropTypes.bool,
    isPartial: PropTypes.bool,
    columnId: PropTypes.string,
    multiColumn: PropTypes.bool,
    hasAnnouncements: PropTypes.bool,
    unreadAnnouncements: PropTypes.number,
    showAnnouncements: PropTypes.bool,
    inflowTunedOut: PropTypes.bool,
    matchesBreakpoint: PropTypes.bool,
  };

  // The Home column shows one status feed at a time, driven by the
  // user's persisted kronk.feed_scope setting (Mates / Orbit /
  // Kommunity). The picker lives on /home/settings; the column reads
  // the setting once on mount. Mates and Orbit both drive the
  // mastodon home timeline for now — the split lands with
  // Kronk::FeatureFlags.feed_scope_enforced. Kommunity drives the
  // local timeline.
  state = {
    reach: 'orbit',
    kommunityInitialized: false,
  };

  loadPersistedFeedScope = async () => {
    try {
      const res = await fetch('/api/v1/kronk_settings', {
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const scope = data?.feed_scope;
      if (scope === 'mates' || scope === 'orbit' || scope === 'kommunity') {
        this.setState(prev => {
          if (prev.reach === scope) return null;
          const next = { reach: scope };
          if (scope === 'kommunity' && !prev.kommunityInitialized) {
            this.props.dispatch(expandCommunityTimeline({}));
            next.kommunityInitialized = true;
          }
          return next;
        });
      }
    } catch {
      // Silent — default reach stays.
    }
  };

  handlePin = () => {
    const { columnId, dispatch } = this.props;

    if (columnId) {
      dispatch(removeColumn(columnId));
    } else {
      dispatch(addColumn('HOME', {}));
    }
  };

  handleMove = (dir) => {
    const { columnId, dispatch } = this.props;
    dispatch(moveColumn(columnId, dir));
  };

  handleHeaderClick = () => {
    this.column.scrollTop();
  };

  setRef = c => {
    this.column = c;
  };

  handleLoadMoreHome = maxId => {
    this.props.dispatch(expandHomeTimeline({ maxId }));
  };

  handleLoadMoreKommunity = maxId => {
    this.props.dispatch(expandCommunityTimeline({ maxId }));
  };

  componentDidMount () {
    setTimeout(() => this.props.dispatch(fetchAnnouncements()), 700);
    this._checkIfReloadNeeded(false, this.props.isPartial);
    void this.loadPersistedFeedScope();
  }

  componentDidUpdate (prevProps) {
    this._checkIfReloadNeeded(prevProps.isPartial, this.props.isPartial);
  }

  componentWillUnmount () {
    this._stopPolling();
  }

  _checkIfReloadNeeded (wasPartial, isPartial) {
    const { dispatch } = this.props;

    if (wasPartial === isPartial) {
      return;
    } else if (!wasPartial && isPartial) {
      this.polling = setInterval(() => {
        dispatch(expandHomeTimeline());
      }, 3000);
    } else if (wasPartial && !isPartial) {
      this._stopPolling();
    }
  }

  _stopPolling () {
    if (this.polling) {
      clearInterval(this.polling);
      this.polling = null;
    }
  }

  handleToggleAnnouncementsClick = (e) => {
    e.stopPropagation();
    this.props.dispatch(toggleShowAnnouncements());
  };

  render () {
    const { intl, hasUnread, columnId, multiColumn, hasAnnouncements, unreadAnnouncements, showAnnouncements, matchesBreakpoint } = this.props;
    const { reach } = this.state;
    const pinned = !!columnId;
    const { signedIn } = this.props.identity;
    const banners = [];

    let announcementsButton;

    if (hasAnnouncements) {
      announcementsButton = (
        <button
          type='button'
          className={classNames('column-header__button', { 'active': showAnnouncements })}
          title={intl.formatMessage(showAnnouncements ? messages.hide_announcements : messages.show_announcements)}
          aria-label={intl.formatMessage(showAnnouncements ? messages.hide_announcements : messages.show_announcements)}
          onClick={this.handleToggleAnnouncementsClick}
        >
          <IconWithBadge id='bullhorn' icon={CampaignIcon} count={unreadAnnouncements} />
        </button>
      );
    }

    const feedSettingsButton = signedIn ? (
      <Link
        to='/home/settings'
        className='column-header__button'
        title={intl.formatMessage(messages.feedSettings)}
        aria-label={intl.formatMessage(messages.feedSettings)}
      >
        <SettingsIcon />
      </Link>
    ) : null;

    const extraButtons = (
      <>
        {announcementsButton}
        {feedSettingsButton}
      </>
    );

    banners.push(<LiveBanner key='live-banner' />);
    if (criticalUpdatesPending) {
      banners.push(<CriticalUpdateBanner key='critical-update-banner' />);
    }

    let feedConfig;
    if (reach === 'kommunity') {
      feedConfig = {
        timelineId: 'community',
        onLoadMore: this.handleLoadMoreKommunity,
        emptyMessage: <FormattedMessage id='empty_column.community' defaultMessage='The local timeline is empty. Write something publicly to get the ball rolling!' />,
        prepend: [],
        insertNode: undefined,
      };
    } else {
      feedConfig = {
        timelineId: 'home',
        onLoadMore: this.handleLoadMoreHome,
        emptyMessage: <FormattedMessage id='empty_column.home' defaultMessage='Your home timeline is empty! Follow more people to fill it up.' />,
        prepend: banners,
        insertNode: this.props.inflowTunedOut ? undefined : <VeilScene key='inflow-veil' />,
      };
    }

    return (
      <Column bindToDocument={!multiColumn} ref={this.setRef} label={intl.formatMessage(messages.title)}>
        <ColumnHeader
          icon='home'
          iconComponent={matchesBreakpoint ? SymbolLogo : HomeIcon}
          active={hasUnread}
          title={intl.formatMessage(messages.title)}
          onPin={this.handlePin}
          onMove={this.handleMove}
          onClick={this.handleHeaderClick}
          pinned={pinned}
          multiColumn={multiColumn}
          extraButton={extraButtons}
          appendContent={hasAnnouncements && showAnnouncements && <Announcements />}
        >
          <ColumnSettings />
        </ColumnHeader>

        {/* Moments Home strip — sits directly under the column header,
            above the feed. Signed-in only. */}
        {signedIn && <MomentsStrip />}

        {/* Inline status composer — reuses the global compose reducer;
            placeholder is the day's Kuestion prompt. Signed-in only. */}
        {signedIn && <HomeStatusBox />}

        {signedIn ? (
          <StatusListContainer
            prepend={feedConfig.prepend}
            alwaysPrepend={feedConfig.prepend.length > 0}
            insertAfter={feedConfig.insertNode ? 2 : undefined}
            insertNode={feedConfig.insertNode}
            trackScroll={!pinned}
            scrollKey={`home_timeline-${feedConfig.timelineId}-${columnId}`}
            onLoadMore={feedConfig.onLoadMore}
            timelineId={feedConfig.timelineId}
            emptyMessage={feedConfig.emptyMessage}
            bindToDocument={!multiColumn}
          />
        ) : <NotSignedInIndicator />}

        <Helmet>
          <title>{intl.formatMessage(messages.title)}</title>
          <meta name='robots' content='noindex' />
        </Helmet>
      </Column>
    );
  }

}

export default connect(mapStateToProps)(withBreakpoint(withIdentity(injectIntl(HomeTimeline))));
