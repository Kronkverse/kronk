import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { defineMessages, injectIntl } from 'react-intl';

import classNames from 'classnames';
import { Redirect, Route, withRouter } from 'react-router-dom';

import { connect } from 'react-redux';

import { debounce } from 'lodash';

import { focusApp, unfocusApp, changeLayout } from 'mastodon/actions/app';
import { fetchKorners } from 'mastodon/actions/korners';
import { synchronouslySubmitMarkers, submitMarkers, fetchMarkers } from 'mastodon/actions/markers';
import { fetchNotifications } from 'mastodon/actions/notification_groups';
import { fetchProfileSections } from 'mastodon/actions/profile_sections';
import { INTRODUCTION_VERSION } from 'mastodon/actions/onboarding';
import { AlertsController } from 'mastodon/components/alerts_controller';
import { Hotkeys } from 'mastodon/components/hotkeys';
import { HoverCardController } from 'mastodon/components/hover_card_controller';
import { BoothPlaybackProvider } from 'mastodon/features/booth/booth_playback_context';
import { NudgeArrivalToast } from 'mastodon/components/nudge_arrival_toast';
import { BoothMiniPlayer } from 'mastodon/features/booth/components/booth_mini_player';
import { HuddlePip } from 'mastodon/features/huddle_pip';
import { PictureInPicture } from 'mastodon/features/picture_in_picture';
import { HubSwitcher } from './components/hub_switcher';
import { KornerSidebar } from './components/korner_sidebar';
import { KronkFrame } from 'mastodon/components/kronk_frame';
import { KronkKosmos } from 'mastodon/features/kosmos/kronk_kosmos';
import { KronkMenu } from './components/kronk_menu';
import { KronkWordmark } from './components/kronk_wordmark';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { layoutFromWindow } from 'mastodon/is_mobile';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

import { uploadCompose, resetCompose, changeComposeSpoilerness } from '../../actions/compose';
import { clearHeight } from '../../actions/height_cache';
import { fetchServer, fetchServerTranslationLanguages } from '../../actions/server';
import { expandHomeTimeline } from '../../actions/timelines';
import { initialState, me, owner, singleUserMode, trendsEnabled, landingPage, localLiveFeedAccess, disableHoverCards } from '../../initial_state';

import BundleColumnError from './components/bundle_column_error';
import { UploadArea } from './components/upload_area';
import { HashtagMenuController } from './components/hashtag_menu_controller';
import PwaInstallPrompt from '../../components/pwa_install_prompt';
import ColumnsAreaContainer from './containers/columns_area_container';
import LoadingBarContainer from './containers/loading_bar_container';
import ModalContainer from './containers/modal_container';
import {
  Compose,
  Status,
  GettingStarted,
  KeyboardShortcuts,
  Firehose,
  AccountTimeline,
  AccountGallery,
  AccountNudges,
  MatesTab,
  HomeTimeline,
  Followers,
  Following,
  Reblogs,
  Favourites,
  HashtagTimeline,
  NotificationRequests,
  NotificationRequest,
  FollowRequests,
  MateRequests,
  MeHub,
  Awawb,
  FavouritedStatuses,
  BookmarkedStatuses,
  FollowedTags,
  LinkTimeline,
  Blocks,
  DomainBlocks,
  Mutes,
  PinnedStatuses,
  OnboardingProfile,
  OnboardingFollows,
  Explore,
  AccountFeatured,
  Quotes,
  Orbit,
  Live,
  LiveRoom,
  EventDetail,
  KalendarSpiral,
  Hub,
  Booth,
  Martketplace,
  MartketplaceNew,
  InflowVeil,
  MapV2,
  Nudges,
  Kommons,
  KommonsProposal,
  KommonsSpace,
  KommonsNodeMeta,
  KommonsProposePicker,
  KronkSearch,
  YouPortal,
  Questions,
  BoothSetPage,
  ProfileSectionsSettings,
  ProfileShelves,
  NudgesLegacyArchive,
  Krews,
  KrewDetail,
  Klot,
  KlotSettings,
  Kommunity,
  KommonsSettings,
  KuestionsSettings,
  Moments,
  MomentViewer,
  Albutts,
  KornerSettings,
  ProfileCompose,
  FeedSettings,
  Connections,
  StyleGuide,
  SettingsHub,
  SettingsYou,
  SettingsKorners,
  AppearanceSettings,
  PostingSettings,
  NotificationsSettings,
  PrivacySettings,
} from './util/async-components';
import { ColumnsContextProvider } from './util/columns_context';
import { focusColumn, getFocusedItemIndex, focusItemSibling } from './util/focusUtils';
import { WrappedSwitch, WrappedRoute } from './util/react_router_helpers';

// Dummy import, to make sure that <Status /> ends up in the application bundle.
// Without this it ends up in ~8 very commonly used bundles.
import '../../components/status';

const messages = defineMessages({
  beforeUnload: { id: 'ui.beforeunload', defaultMessage: 'Your draft will be lost if you leave Kronk.' },
});

const mapStateToProps = state => ({
  layout: state.getIn(['meta', 'layout']),
  isComposing: state.getIn(['compose', 'is_composing']),
  hasComposingContents: state.getIn(['compose', 'text']).trim().length !== 0 || state.getIn(['compose', 'media_attachments']).size > 0 || state.getIn(['compose', 'poll']) !== null || state.getIn(['compose', 'quoted_status_id']) !== null,
  canUploadMore: !state.getIn(['compose', 'media_attachments']).some(x => ['audio', 'video'].includes(x.get('type'))) && state.getIn(['compose', 'media_attachments']).size < state.getIn(['server', 'server', 'configuration', 'statuses', 'max_media_attachments']),
  firstLaunch: state.getIn(['settings', 'introductionVersion'], 0) < INTRODUCTION_VERSION,
  newAccount: !state.getIn(['accounts', me, 'note']) && !state.getIn(['accounts', me, 'bot']) && state.getIn(['accounts', me, 'following_count'], 0) === 0 && state.getIn(['accounts', me, 'statuses_count'], 0) === 0,
  username: state.getIn(['accounts', me, 'username']),
});

class SwitchingColumnsArea extends PureComponent {
  static propTypes = {
    identity: identityContextPropShape,
    children: PropTypes.node,
    location: PropTypes.object,
    singleColumn: PropTypes.bool,
    forceOnboarding: PropTypes.bool,
  };

  UNSAFE_componentWillMount () {
    document.body.classList.toggle('layout-single-column', this.props.singleColumn);
    document.body.classList.toggle('layout-multiple-columns', !this.props.singleColumn);
  }

  componentDidUpdate (prevProps) {
    if (![this.props.location.pathname, '/'].includes(prevProps.location.pathname)) {
      this.node.handleChildrenContentChange();
    }

    if (prevProps.singleColumn !== this.props.singleColumn) {
      document.body.classList.toggle('layout-single-column', this.props.singleColumn);
      document.body.classList.toggle('layout-multiple-columns', !this.props.singleColumn);
    }
  }

  setRef = c => {
    if (c) {
      this.node = c;
    }
  };

  render () {
    const { children, singleColumn, forceOnboarding } = this.props;
    const { signedIn } = this.props.identity;
    const pathName = this.props.location.pathname;

    let redirect;

    if (signedIn) {
      if (forceOnboarding) {
        redirect = <Redirect from='/' to='/start' exact />;
      } else if (singleColumn) {
        redirect = <Redirect from='/' to='/home' exact />;
      } else {
        redirect = <Redirect from='/' to='/deck/getting-started' exact />;
      }
    } else if (singleUserMode && owner && initialState?.accounts[owner]) {
      redirect = <Redirect from='/' to={`/@${initialState.accounts[owner].username}`} exact />;
    } else if (trendsEnabled && landingPage === 'trends') {
      redirect = <Redirect from='/' to='/explore' exact />;
    } else if (localLiveFeedAccess === 'public' && landingPage === 'local_feed') {
      redirect = <Redirect from='/' to='/public/local' exact />;
    } else {
      // The old fallback was `/about`, but About / Privacy / Terms
      // moved to Rails-served /kronk/*; they no longer exist as SPA
      // routes. Land on Explore so a signed-out visitor with no
      // trends/local-feed configured still sees something.
      redirect = <Redirect from='/' to='/explore' exact />;
    }

    return (
      <ColumnsContextProvider multiColumn={!singleColumn}>
        <ColumnsAreaContainer ref={this.setRef} singleColumn={singleColumn}>
          <WrappedSwitch>
            {redirect}

            {singleColumn ? <Redirect from='/deck' to='/home' exact /> : null}
            {singleColumn && pathName.startsWith('/deck/') ? <Redirect from={pathName} to={{...this.props.location, pathname: pathName.slice(5)}} /> : null}
            {/* Redirect old bookmarks (without /deck) with home-like routes to the advanced interface */}
            {!singleColumn && pathName === '/home' ? <Redirect from='/home' to='/deck/getting-started' exact /> : null}
            {pathName === '/getting-started' ? <Redirect from='/getting-started' to={singleColumn ? '/home' : '/deck/getting-started'} exact /> : null}

            <WrappedRoute path='/getting-started' component={GettingStarted} content={children} />
            <WrappedRoute path='/keyboard-shortcuts' component={KeyboardShortcuts} content={children} />
            {/* /about, /privacy-policy, /terms-of-service moved to
                Rails-served /kronk/* (2026-08-02). The corresponding
                SPA feature bundles are unreferenced and cleaned up in
                async-components.js. */}

            {signedIn && <WrappedRoute path='/home/settings' exact component={FeedSettings} content={children} />}
            <WrappedRoute path={['/home', '/timelines/home']} exact component={HomeTimeline} content={children} />
            <Redirect from='/timelines/public' to='/public' exact />
            <Redirect from='/timelines/public/local' to='/public/local' exact />
            <WrappedRoute path='/public' exact component={Firehose} componentParams={{ feedType: 'public' }} content={children} />
            <WrappedRoute path='/public/local' exact component={Firehose} componentParams={{ feedType: 'community' }} content={children} />
            <WrappedRoute path='/public/remote' exact component={Firehose} componentParams={{ feedType: 'public:remote' }} content={children} />
            {/* DMs live in the Nudges messenger — the classic direct-timeline is retired. */}
            <Redirect from='/conversations' to='/nudges' />
            <Redirect from='/timelines/direct' to='/nudges' />
            <WrappedRoute path='/tags/:id' component={HashtagTimeline} content={children} />
            <WrappedRoute path='/links/:url' component={LinkTimeline} content={children} />
            {/* Phase 5.5 — Nudges takes over the notification surface.
                Classic bell UI is CSS-hidden via _kronk_chrome.scss;
                any residual muscle-memory links to /notifications
                redirect to the Activity feed. Old routes still mount
                for the archive tab. */}
            {/* Nudges activity feed retired 2026-07-21 in favour of the Signal-shaped
                messenger surface. Legacy /notifications and /nudges/activity
                URLs redirect to /nudges. See docs/kronk_nudges.md. */}
            <Redirect from='/notifications' to='/nudges' exact />
            <Redirect from='/nudges/activity' to='/nudges' exact />
            <WrappedRoute path='/notifications/requests' component={NotificationRequests} content={children} exact />
            <WrappedRoute path='/notifications/requests/:id' component={NotificationRequest} content={children} exact />
            <WrappedRoute path='/favourites' component={FavouritedStatuses} content={children} />

            <WrappedRoute path='/bookmarks' component={BookmarkedStatuses} content={children} />
            <WrappedRoute path='/pinned' component={PinnedStatuses} content={children} />

            <WrappedRoute path={['/start', '/start/profile']} exact component={OnboardingProfile} content={children} />
            <WrappedRoute path='/start/follows' component={OnboardingFollows} content={children} />
            {/* Legacy Mastodon `/directory` — retired 2026-08-05 in
                favour of `/hub/kommunity/discover`, the Kronk-native
                Discover list (docs/rebuild/decisions.md). Any inbound
                link — federation mail, third-party embed, cached
                bookmark — lands at Discover instead of a dead SPA
                route. The `/api/v1/directory` endpoint stays intact
                for federation-facing external consumers. */}
            <Redirect from='/directory' to='/hub/kommunity/discover' />
            <WrappedRoute path='/explore' component={Explore} content={children} />
            {/* /me — signed-in radial hub of self actions (Profile
                / Timeline / Mates / Switch / Invite / Sign out).
                See features/me_hub. */}
            {signedIn && <WrappedRoute path='/me' exact component={MeHub} content={children} />}
            {/* /awawb — a still page. Reached from the middle pillar
                of the top Membrane. See features/awawb. */}
            <WrappedRoute path='/awawb' exact component={Awawb} content={children} />
            <WrappedRoute path="/orbit" component={Orbit} content={children} />
            {/* Per-korner settings MUST come before any specific
                /hub/<slug> route — otherwise non-exact korner routes
                (e.g. /hub/klot) swallow /hub/<slug>/settings and the
                korner's default view renders instead of the settings
                page. Standard L12 (docs/korners/korner_standard.md)
                requires every korner reach its settings via this
                route; placing it first here is what makes that
                promise real. Regressed silently before this pass
                because it originally sat after /hub/klot / /hub/krew
                / /hub/huddle. */}
            {/* Bespoke settings pages MUST sit before the generic
                `/hub/:slug/settings` mount below so they win the
                match for their slug. Standard §L8 (revised alpha.254)
                permits bespoke pages when the korner has live state
                to render alongside its options. */}
            {signedIn && <WrappedRoute path='/hub/klot/settings' exact component={KlotSettings} content={children} />}
            {signedIn && <WrappedRoute path='/hub/kommons/settings' exact component={KommonsSettings} content={children} />}
            {signedIn && <WrappedRoute path='/hub/kuestions/settings' exact component={KuestionsSettings} content={children} />}
            {signedIn && <WrappedRoute path='/hub/:slug/settings' exact component={KornerSettings} content={children} />}
            {/* Huddle is a korner surface at /hub/huddle; the legacy
                /huddle path forwards to it. `/hub/huddle` renders the
                Main Huddle lobby + the open Rooms discovery list
                (Phase 9.6). `/hub/huddle/room/:id` is a per-Room lobby
                → per-Room Jitsi. Krew Huddles come with Phase 9.1/9.2. */}
            <Redirect from='/huddle' to='/hub/huddle' exact />
            {signedIn && <WrappedRoute path='/hub/huddle/room/:id' exact component={LiveRoom} content={children} />}
            {signedIn && <WrappedRoute path='/hub/huddle/new' exact component={Live} componentParams={{ autoOpenNewRoom: true }} content={children} />}
            {signedIn && <WrappedRoute path='/hub/huddle' exact component={Live} content={children} />}
            <WrappedRoute path={["/booth/sets/:id", "/hub/booth/sets/:id"]} component={BoothSetPage} content={children} />
            {/* Native Booth. The non-exact /hub/booth match also catches the
                lens sub-paths (/hub/booth/musik, /artists, …); the component
                reads the lens from the URL. Set detail is matched above. */}
            <WrappedRoute path={["/booth", "/hub/booth"]} component={Booth} content={children} />
            {signedIn && <WrappedRoute path='/settings' exact stage component={SettingsHub} content={children} />}
            {signedIn && <WrappedRoute path='/settings/you' exact stage component={SettingsYou} content={children} />}
            {signedIn && <WrappedRoute path='/hub/settings' exact component={SettingsKorners} content={children} />}
            {signedIn && <WrappedRoute path='/settings/appearance' exact stage component={AppearanceSettings} content={children} />}
            {signedIn && <WrappedRoute path='/settings/posting' exact stage component={PostingSettings} content={children} />}
            {signedIn && <WrappedRoute path='/settings/notifications' exact stage component={NotificationsSettings} content={children} />}
            {signedIn && <WrappedRoute path='/settings/privacy' exact stage component={PrivacySettings} content={children} />}
            {signedIn && <WrappedRoute path="/settings/profile_sections" component={ProfileSectionsSettings} content={children} />}
            {/* Shelved profile — the 2026-08-01 rebuild replaces the
                old SectionedProfile at `/@:acct` and `/@:acct/profile`.
                `/@:acct/shelves` stays as an explicit alias for
                inbound links that were minted during the parallel
                development window. */}
            <WrappedRoute path={['/@:acct/profile', '/@:acct/shelves']} exact component={ProfileShelves} content={children} />
            {/* Kalendar Rebuild (proposal #116969253949249128) — the Spiral
                is now the Kalendar. Bare /hub/kalendar renders KalendarSpiral;
                the old Events list component retires. /hub/kalendar/:id
                still opens EventDetail (individual events keep their own
                pages until the Spiral wires day-picking into them). */}
            {signedIn && <WrappedRoute path={["/kalendar/:id", "/hub/kalendar/:id"]} component={EventDetail} content={children} />}
            {signedIn && <WrappedRoute path={["/kalendar", "/hub/kalendar"]} component={KalendarSpiral} content={children} />}
            {signedIn && <WrappedRoute path="/hub/inflow" component={InflowVeil} content={children} />}
            {signedIn && <WrappedRoute path="/nudges/legacy" component={NudgesLegacyArchive} content={children} />}
            {/* Krews (§KRONK_KREWS). Route order matters: /hub/krew/composer,
                /hub/krew/new (legacy alias), and /hub/krew/discover (the
                Discover SpaceNav view) must resolve before /hub/krew/:id or
                they get treated as a krew id lookup. Detail accepts either
                the numeric id or the slug (controller#set_krew disambiguates).
                The composer is a `<ComposeShell>` overlay mounted by the
                Krews directory — matches the Albutts + Moments pattern
                (docs/rebuild/decisions.md 2026-08-12). /hub/krew/new is
                preserved as a legacy alias for pre-shell bookmarks. */}
            {signedIn && <WrappedRoute path='/hub/krew/composer' exact component={Krews} componentParams={{ autoOpenComposer: true }} content={children} />}
            {signedIn && <WrappedRoute path='/hub/krew/new' exact component={Krews} componentParams={{ autoOpenComposer: true }} content={children} />}
            {signedIn && <WrappedRoute path='/hub/krew/discover' exact component={Krews} content={children} />}
            {signedIn && <WrappedRoute path='/hub/krew/:id' component={KrewDetail} content={children} />}
            {signedIn && <WrappedRoute path='/hub/krew' component={Krews} content={children} />}
            {/* Klot — cycle tracker (KRONK_TIDES). Requires signed-in
                because the client immediately hits /api/v1/klot/self. */}
            {signedIn && <WrappedRoute path='/hub/klot' component={Klot} content={children} />}
            {/* Kommunity — whole-graph 3D orb view (KRONK_ORB_DATA_BRIEF).
                Reads the same Mates data the Kosmos background layer uses;
                bundled synthesised edges until the Mates endpoint lands. */}
            <WrappedRoute path='/hub/kommunity' component={Kommunity} content={children} />
            <WrappedRoute path='/hub' exact component={Hub} content={children} />
            <WrappedRoute path='/styleguide' exact component={StyleGuide} content={children} />
            {/* Order matters: /:id must precede the bare /hub/moments
                so the viewer takes precedence over the grid. */}
            <WrappedRoute path='/hub/moments/:id' component={MomentViewer} content={children} />
            <WrappedRoute path='/hub/moments' exact component={Moments} content={children} />
            <WrappedRoute path='/hub/albutts' component={Albutts} content={children} />
            <Redirect from='/hub/kompass' to='/hub/map' />
            <WrappedRoute path='/hub/map' component={MapV2} content={children} />
            {/* /new must sit before the wildcard so the composer route
                wins over the KornerShell's fallback-to-default view. */}
            {signedIn && <WrappedRoute path='/hub/martketplace/new' exact component={MartketplaceNew} content={children} />}
            <WrappedRoute path='/hub/martketplace' component={Martketplace} content={children} />
            <WrappedRoute path='/@:acct/connections' exact component={Connections} content={children} />
            {/* Phase 1b: the messenger shell handles both /nudges (empty pane)
                and /nudges/:conversationId (open pane). Legacy account-scoped
                thread route deprecated — existing NudgeMessage history stays
                queryable via /nudges/legacy until Phase 14. */}
            {/* Numeric ids are Mate conversations; `kronk` is the system
                nudger sentinel (KRONK_CONVERSATION_ID) — both open the
                messenger, which renders KronkSystemView for the sentinel. */}
            {signedIn && <WrappedRoute path="/nudges/:conversationId(\d+|kronk)" component={Nudges} content={children} />}
            {signedIn && <WrappedRoute path="/nudges" component={Nudges} content={children} exact />}
            {signedIn && <Redirect from="/hub/kommons/skeleton" to="/hub/kommons" />}
            {/* The Directory (Lattice) used to live at /hub/kommons/lattice
                with its own route + component. It's now the default face of
                the Kommons rotator (bare `/hub/kommons` in the manifest),
                embedded inline in the Kommons component so the FeedDrum
                rotation carries Directory ↔ proposal faces as one spindle.
                Redirect kept for external / internal links that still
                point at /lattice (space_page, node_meta_page). */}
            {signedIn && <Redirect from="/hub/kommons/lattice" to="/hub/kommons" exact />}
            {signedIn && <WrappedRoute path="/hub/kommons/p/:proposalId" component={KommonsProposal} content={children} />}
            {signedIn && <WrappedRoute path="/hub/kommons/space/:slug" component={KommonsSpace} content={children} />}
            {signedIn && <WrappedRoute path="/hub/kommons/node/:nodeId" component={KommonsNodeMeta} content={children} />}
            {signedIn && <WrappedRoute path="/hub/kommons/pick" component={KommonsProposePicker} content={children} />}
            {/* Composer lives in the Ж bubble → picker → shell flow. Canonical
                URL is `/hub/kommons/composer`; `/hub/kommons/propose` is
                preserved as a legacy alias for pre-shell links. Both mount
                <Kommons autoOpenComposer /> so the directory sits behind the
                overlay (docs/rebuild/decisions.md 2026-08-12). */}
            {signedIn && <WrappedRoute path="/hub/kommons/composer" component={Kommons} componentParams={{ autoOpenComposer: true }} content={children} />}
            {signedIn && <WrappedRoute path="/hub/kommons/propose" component={Kommons} componentParams={{ autoOpenComposer: true }} content={children} />}
            {signedIn && <Redirect from="/governance" to="/hub/kommons" exact />}
            {signedIn && <WrappedRoute path="/hub/kommons" component={Kommons} content={children} />}
            {signedIn && <WrappedRoute path={["/questions/:id", "/hub/kuestions/:id", "/questions", "/hub/kuestions"]} component={Questions} content={children} />}
            <WrappedRoute path='/hub/search' component={KronkSearch} content={children} />
            <WrappedRoute path='/hub/you' component={YouPortal} content={children} />
            <WrappedRoute path={['/publish', '/statuses/new']} component={Compose} content={children} />

            {/* /@:acct renders the shelved profile by default (Kronk 2.0
                — the profile IS the shelved view). The classic timeline
                remains available at /@:acct/posts for people who prefer
                the flat feed. */}
            <WrappedRoute path={['/@:acct', '/accounts/:id']} exact component={ProfileShelves} content={children} />
            {signedIn && <WrappedRoute path='/@:acct/edit' exact component={ProfileCompose} content={children} />}
            <WrappedRoute path={['/@:acct/posts', '/accounts/:id/posts']} component={AccountTimeline} content={children} />
            <WrappedRoute path={['/@:acct/featured', '/accounts/:id/featured']} component={AccountFeatured} content={children} />
            <WrappedRoute path='/@:acct/tagged/:tagged?' exact component={AccountTimeline} content={children} />
            <WrappedRoute path={['/@:acct/with_replies', '/accounts/:id/with_replies']} component={AccountTimeline} content={children} componentParams={{ withReplies: true }} />
            <WrappedRoute path={['/accounts/:id/followers', '/users/:acct/followers', '/@:acct/followers']} component={Followers} content={children} />
            <WrappedRoute path={['/accounts/:id/following', '/users/:acct/following', '/@:acct/following']} component={Following} content={children} />
            <WrappedRoute path={['/@:acct/media', '/accounts/:id/media']} component={AccountGallery} content={children} />
            {signedIn && <WrappedRoute path='/@:acct/nudges' component={AccountNudges} content={children} />}
            {/* Mates tab — per-member timeline view (Kommons "Mates" proposal).
                Stub until the timeline unresolveds are settled. Must sit
                before the /@:acct/:statusId wildcard so `mates` isn't
                treated as a status id. */}
            <WrappedRoute path='/@:acct/mates' stage component={MatesTab} content={children} />
            <WrappedRoute path='/@:acct/:statusId' exact component={Status} content={children} />
            <WrappedRoute path='/@:acct/:statusId/reblogs' component={Reblogs} content={children} />
            <WrappedRoute path='/@:acct/:statusId/favourites' component={Favourites} content={children} />
            <WrappedRoute path='/@:acct/:statusId/quotes' component={Quotes} content={children} />

            {/* Legacy routes, cannot be easily factored with other routes because they share a param name */}
            <WrappedRoute path='/timelines/tag/:id' component={HashtagTimeline} content={children} />
            <WrappedRoute path='/statuses/:statusId' exact component={Status} content={children} />
            <WrappedRoute path='/statuses/:statusId/reblogs' component={Reblogs} content={children} />
            <WrappedRoute path='/statuses/:statusId/favourites' component={Favourites} content={children} />

            <WrappedRoute path='/follow_requests' component={FollowRequests} content={children} />
            <WrappedRoute path='/mate_requests' component={MateRequests} content={children} />
            <WrappedRoute path='/blocks' component={Blocks} content={children} />
            <WrappedRoute path='/domain_blocks' component={DomainBlocks} content={children} />
            <WrappedRoute path='/followed_tags' component={FollowedTags} content={children} />
            <WrappedRoute path='/mutes' component={Mutes} content={children} />

            <Route component={BundleColumnError} />
          </WrappedSwitch>
        </ColumnsAreaContainer>
      </ColumnsContextProvider>
    );
  }

}

class UI extends PureComponent {
  static propTypes = {
    identity: identityContextPropShape,
    dispatch: PropTypes.func.isRequired,
    children: PropTypes.node,
    isComposing: PropTypes.bool,
    hasComposingContents: PropTypes.bool,
    canUploadMore: PropTypes.bool,
    intl: PropTypes.object.isRequired,
    layout: PropTypes.string.isRequired,
    firstLaunch: PropTypes.bool,
    newAccount: PropTypes.bool,
    username: PropTypes.string,
    ...WithRouterPropTypes,
  };

  state = {
    draggingOver: false,
  };

  handleBeforeUnload = e => {
    const { intl, dispatch, isComposing, hasComposingContents } = this.props;

    dispatch(synchronouslySubmitMarkers());

    if (isComposing && hasComposingContents) {
      e.preventDefault();
      // Setting returnValue to any string causes confirmation dialog.
      // Many browsers no longer display this text to users,
      // but we set user-friendly message for other browsers, e.g. Edge.
      e.returnValue = intl.formatMessage(messages.beforeUnload);
    }
  };

  handleWindowFocus = () => {
    this.props.dispatch(focusApp());
    this.props.dispatch(submitMarkers({ immediate: true }));
  };

  handleWindowBlur = () => {
    this.props.dispatch(unfocusApp());
  };

  handleDragEnter = (e) => {
    e.preventDefault();

    if (!this.dragTargets) {
      this.dragTargets = [];
    }

    if (this.dragTargets.indexOf(e.target) === -1) {
      this.dragTargets.push(e.target);
    }

    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files') && this.props.canUploadMore && this.props.identity.signedIn) {
      this.setState({ draggingOver: true });
    }
  };

  handleDragOver = (e) => {
    if (this.dataTransferIsText(e.dataTransfer)) return false;

    e.preventDefault();
    e.stopPropagation();

    try {
      e.dataTransfer.dropEffect = 'copy';
    } catch {
      // do nothing
    }

    return false;
  };

  handleDrop = (e) => {
    if (this.dataTransferIsText(e.dataTransfer)) return;

    e.preventDefault();

    this.setState({ draggingOver: false });
    this.dragTargets = [];

    if (e.dataTransfer && e.dataTransfer.files.length >= 1 && this.props.canUploadMore && this.props.identity.signedIn) {
      this.props.dispatch(uploadCompose(e.dataTransfer.files));
    }
  };

  handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    this.dragTargets = this.dragTargets.filter(el => el !== e.target && this.node.contains(el));

    if (this.dragTargets.length > 0) {
      return;
    }

    this.setState({ draggingOver: false });
  };

  dataTransferIsText = (dataTransfer) => {
    return (dataTransfer && Array.from(dataTransfer.types).filter((type) => type === 'text/plain').length === 1);
  };

  closeUploadModal = () => {
    this.setState({ draggingOver: false });
  };

  handleServiceWorkerPostMessage = ({ data }) => {
    if (data.type === 'navigate') {
      this.props.history.push(data.path);
    } else {
      console.warn('Unknown message type:', data.type);
    }
  };

  handleLayoutChange = debounce(() => {
    this.props.dispatch(clearHeight()); // The cached heights are no longer accurate, invalidate
  }, 500, {
    trailing: true,
  });

  handleResize = () => {
    const layout = layoutFromWindow();

    if (layout !== this.props.layout) {
      this.handleLayoutChange.cancel();
      this.props.dispatch(changeLayout({ layout }));
    } else {
      this.handleLayoutChange();
    }
  };

  handleDonate = () => {
    location.href = 'https://joinmastodon.org/sponsors#donate'
  }

  componentDidMount () {
    const { signedIn } = this.props.identity;

    window.addEventListener('focus', this.handleWindowFocus, false);
    window.addEventListener('blur', this.handleWindowBlur, false);
    window.addEventListener('beforeunload', this.handleBeforeUnload, false);
    window.addEventListener('resize', this.handleResize, { passive: true });

    document.addEventListener('dragenter', this.handleDragEnter, false);
    document.addEventListener('dragover', this.handleDragOver, false);
    document.addEventListener('drop', this.handleDrop, false);
    document.addEventListener('dragleave', this.handleDragLeave, false);
    document.addEventListener('dragend', this.handleDragEnd, false);

    if ('serviceWorker' in  navigator) {
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerPostMessage);
    }

    // Korner manifests are public — fetch unconditionally so /kronk,
    // /hub, and unauthenticated feed cards have display data.
    this.props.dispatch(fetchKorners());

    if (signedIn) {
      this.props.dispatch(fetchMarkers());
      this.props.dispatch(expandHomeTimeline());
      this.props.dispatch(fetchNotifications());
      this.props.dispatch(fetchServerTranslationLanguages());
      this.props.dispatch(fetchProfileSections());

      setTimeout(() => this.props.dispatch(fetchServer()), 3000);
    }
  }

  componentWillUnmount () {
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    window.removeEventListener('resize', this.handleResize);

    document.removeEventListener('dragenter', this.handleDragEnter);
    document.removeEventListener('dragover', this.handleDragOver);
    document.removeEventListener('drop', this.handleDrop);
    document.removeEventListener('dragleave', this.handleDragLeave);
    document.removeEventListener('dragend', this.handleDragEnd);
  }

  setRef = c => {
    this.node = c;
  };

  handleHotkeyNew = e => {
    e.preventDefault();

    const element = this.node.querySelector('.autosuggest-textarea__textarea');

    if (element) {
      element.focus();
    }
  };

  handleHotkeySearch = e => {
    e.preventDefault();

    const element = this.node.querySelector('.search__input');

    if (element) {
      element.focus();
    }
  };

  handleHotkeyForceNew = e => {
    this.handleHotkeyNew(e);
    this.props.dispatch(resetCompose());
  };

  handleHotkeyToggleComposeSpoilers = e => {
    e.preventDefault();
    this.props.dispatch(changeComposeSpoilerness());
  };

  handleHotkeyFocusColumn = e => {
    focusColumn({index: e.key * 1});
  };

  handleHotkeyLoadMore = () => {
    document.querySelector('.load-more')?.focus();
  };

  handleMoveUp = () => {
    const currentItemIndex = getFocusedItemIndex();
    if (currentItemIndex === -1) {
      focusColumn({
        index: 1,
        focusItem: 'first-visible',
      });
    } else {
      focusItemSibling(currentItemIndex, -1);
    }
  };

  handleMoveDown = () => {
    const currentItemIndex = getFocusedItemIndex();
    if (currentItemIndex === -1) {
      focusColumn({
        index: 1,
        focusItem: 'first-visible',
      });
    } else {
      focusItemSibling(currentItemIndex, 1);
    }
  };

  handleHotkeyBack = e => {
    e.preventDefault();

    const { history } = this.props;

    if (history.location?.state?.fromMastodon) {
      history.goBack();
    } else {
      history.push('/');
    }
  };

  handleHotkeyToggleHelp = () => {
    if (this.props.location.pathname === '/keyboard-shortcuts') {
      this.props.history.goBack();
    } else {
      this.props.history.push('/keyboard-shortcuts');
    }
  };

  handleHotkeyGoToHome = () => {
    this.props.history.push('/home');
  };

  handleHotkeyGoToNotifications = () => {
    // Notifications hotkey routes to Nudges (activity feed retired
    // 2026-07-21 for the messenger surface — see docs/kronk_nudges.md).
    this.props.history.push('/nudges');
  };

  handleHotkeyGoToLocal = () => {
    this.props.history.push('/public/local');
  };

  handleHotkeyGoToFederated = () => {
    this.props.history.push('/public');
  };

  handleHotkeyGoToDirect = () => {
    this.props.history.push('/conversations');
  };

  handleHotkeyGoToStart = () => {
    this.props.history.push('/getting-started');
  };

  handleHotkeyGoToFavourites = () => {
    this.props.history.push('/favourites');
  };

  handleHotkeyGoToPinned = () => {
    this.props.history.push('/pinned');
  };

  handleHotkeyGoToProfile = () => {
    this.props.history.push(`/@${this.props.username}`);
  };

  handleHotkeyGoToBlocked = () => {
    this.props.history.push('/blocks');
  };

  handleHotkeyGoToMuted = () => {
    this.props.history.push('/mutes');
  };

  handleHotkeyGoToRequests = () => {
    this.props.history.push('/follow_requests');
  };

  render () {
    const { draggingOver } = this.state;
    const { children, isComposing, location, layout, firstLaunch, newAccount } = this.props;

    const handlers = {
      help: this.handleHotkeyToggleHelp,
      new: this.handleHotkeyNew,
      search: this.handleHotkeySearch,
      forceNew: this.handleHotkeyForceNew,
      toggleComposeSpoilers: this.handleHotkeyToggleComposeSpoilers,
      focusColumn: this.handleHotkeyFocusColumn,
      focusLoadMore: this.handleHotkeyLoadMore,
      moveDown: this.handleMoveDown,
      moveUp: this.handleMoveUp,
      back: this.handleHotkeyBack,
      goToHome: this.handleHotkeyGoToHome,
      goToNotifications: this.handleHotkeyGoToNotifications,
      goToLocal: this.handleHotkeyGoToLocal,
      goToFederated: this.handleHotkeyGoToFederated,
      goToDirect: this.handleHotkeyGoToDirect,
      goToStart: this.handleHotkeyGoToStart,
      goToFavourites: this.handleHotkeyGoToFavourites,
      goToPinned: this.handleHotkeyGoToPinned,
      goToProfile: this.handleHotkeyGoToProfile,
      goToBlocked: this.handleHotkeyGoToBlocked,
      goToMuted: this.handleHotkeyGoToMuted,
      goToRequests: this.handleHotkeyGoToRequests,
      cheat: this.handleDonate,
    };

    return (
      <Hotkeys global handlers={handlers}>
        <BoothPlaybackProvider>
        <div className={classNames('ui', { 'is-composing': isComposing })} ref={this.setRef}>
          {/* KronkKosmos — ambient background layer (docs/kronk_frame.md
              § Kosmos). Full-viewport canvas at z-0, deliberately outside
              the Frame grid so it spans regardless of slot geometry. The
              one Frame-parasite exception the Standard L11 doctor
              allow-lists by class name. */}
          <KronkKosmos />
          {/* KronkFrame — foundational page layout (docs/kronk_frame.md).
              Chrome components render inside their named slots as flow
              children instead of self-anchoring with position: fixed.
              KronkMenu (Ж) is the OVERLAY layer — deliberately outside
              the grid. */}
          <KronkFrame>
            <KronkFrame.TopBand>
              <KronkWordmark />
              {/* HubSwitcher pillars (Me / Home / Hub / Nudges) are
                  useless for a signed-out visitor — Me/Nudges are
                  auth-only, Home/Hub bounce to /about or the login
                  page. Hide the whole thing when signed out. The
                  top-band SCSS uses `:has(.hub-switcher)` to recentre
                  the wordmark when the switcher isn't rendered. */}
              {this.props.identity.signedIn && layout !== 'mobile' && <HubSwitcher variant='top' currentAccountUsername={this.props.username} />}
            </KronkFrame.TopBand>
            {/* Frame-provided per-space nav lives inline via
                <SpaceHeaderRow> inside Stage now (see
                docs/kronk_frame.md § SpaceNav). The old fixed pills
                overlay is retired so the pills scroll with the rest
                of the page. The SpaceNav grid slot stays emitted for
                backwards compat but renders empty. */}
            <KronkFrame.SpaceNav />
            <KronkFrame.RightBand>
              {this.props.identity.signedIn && <KornerSidebar />}
            </KronkFrame.RightBand>
            <KronkFrame.BottomBand>
              {layout === 'mobile' && <HubSwitcher variant='bottom' currentAccountUsername={this.props.username} />}
            </KronkFrame.BottomBand>
            <KronkFrame.Stage>
              <SwitchingColumnsArea identity={this.props.identity} location={location} singleColumn={layout === 'mobile' || layout === 'single-column'} forceOnboarding={firstLaunch && newAccount}>
                {children}
              </SwitchingColumnsArea>
            </KronkFrame.Stage>
          </KronkFrame>

          {layout !== 'mobile' && <PictureInPicture />}
          <BoothMiniPlayer />
          <HuddlePip />
          <NudgeArrivalToast />
          <AlertsController />

          {/* Top-right Invite button retired 2026-08-05 — /me hub
              carries the Invite spoke now (features/me_hub/index.tsx),
              so the persistent chrome affordance is redundant. Rails-
              served pages still emit their static twin from
              _kronk_static_chrome.html.haml (its own concern; kept
              until the same retirement pass reaches Rails chrome). */}
          {this.props.identity.signedIn && <KronkMenu />}
          {!disableHoverCards && <HoverCardController />}
          <HashtagMenuController />
          <PwaInstallPrompt />
          <LoadingBarContainer className='loading-bar' />
          <ModalContainer />
          <UploadArea active={draggingOver} onClose={this.closeUploadModal} />
        </div>
        </BoothPlaybackProvider>
      </Hotkeys>
    );
  }

}

export default connect(mapStateToProps)(injectIntl(withRouter(withIdentity(UI))));
