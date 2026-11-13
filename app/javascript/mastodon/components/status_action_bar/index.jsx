import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import { Link, withRouter } from 'react-router-dom';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import { showAlertForError } from 'mastodon/actions/alerts';
import { importFetchedStatus } from 'mastodon/actions/importer';
import { openModal } from 'mastodon/actions/modal';
import { clearTimeline, expandAccountTimeline } from 'mastodon/actions/timelines';
import api from 'mastodon/api';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import ReplyIcon from '@/material-icons/400-24px/reply.svg?react';
import ReplyAllIcon from '@/material-icons/400-24px/reply_all.svg?react';
import HeartIcon from '@/material-icons/400-24px/favorite-fill.svg?react';
import HeartBorderIcon from '@/material-icons/400-24px/favorite.svg?react';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

import { me } from '../../initial_state';

import { AnimatedNumber } from '../animated_number';
import { IconButton } from '../icon_button';
import { NudgeButton } from '../status/nudge_button';

const messages = defineMessages({
  delete: { id: 'status.delete', defaultMessage: 'Delete' },
  removeFromProfile: { id: 'status.remove_from_profile', defaultMessage: 'Remove from my profile' },
  redraft: { id: 'status.redraft', defaultMessage: 'Delete & re-draft' },
  edit: { id: 'status.edit', defaultMessage: 'Edit' },
  mute: { id: 'account.mute', defaultMessage: 'Mute @{name}' },
  block: { id: 'account.block', defaultMessage: 'Block @{name}' },
  reply: { id: 'status.reply', defaultMessage: 'Reply' },
  repost: { id: 'status.repost', defaultMessage: 'Repost' },
  share: { id: 'status.share', defaultMessage: 'Share' },
  more: { id: 'status.more', defaultMessage: 'More' },
  whoCanSee: { id: 'status.who_can_see', defaultMessage: 'Who can see this?' },
  replyAll: { id: 'status.replyAll', defaultMessage: 'Reply to thread' },
  favourite: { id: 'status.favourite', defaultMessage: 'Froth' },
  removeFavourite: { id: 'status.remove_favourite', defaultMessage: 'Remove froth' },
  frothedBy: { id: 'status.frothed_by', defaultMessage: 'Who frothed this' },
  open: { id: 'status.open', defaultMessage: 'Expand this status' },
  report: { id: 'status.report', defaultMessage: 'Report @{name}' },
  muteConversation: { id: 'status.mute_conversation', defaultMessage: 'Mute conversation' },
  unmuteConversation: { id: 'status.unmute_conversation', defaultMessage: 'Unmute conversation' },
  pin: { id: 'status.pin', defaultMessage: 'Pin on profile' },
  unpin: { id: 'status.unpin', defaultMessage: 'Unpin from profile' },
  embed: { id: 'status.embed', defaultMessage: 'Get embed code' },
  admin_account: { id: 'status.admin_account', defaultMessage: 'Open moderation interface for @{name}' },
  admin_status: { id: 'status.admin_status', defaultMessage: 'Open this post in the moderation interface' },
  admin_domain: { id: 'status.admin_domain', defaultMessage: 'Open moderation interface for {domain}' },
  copy: { id: 'status.copy', defaultMessage: 'Copy link to post' },
  blockDomain: { id: 'account.block_domain', defaultMessage: 'Block domain {domain}' },
  unblockDomain: { id: 'account.unblock_domain', defaultMessage: 'Unblock domain {domain}' },
  unmute: { id: 'account.unmute', defaultMessage: 'Unmute @{name}' },
  unblock: { id: 'account.unblock', defaultMessage: 'Unblock @{name}' },
  filter: { id: 'status.filter', defaultMessage: 'Filter this post' },
  openOriginalPage: { id: 'account.open_original_page', defaultMessage: 'Open original page' },
  revokeQuote: { id: 'status.revoke_quote', defaultMessage: 'Remove my post from @{name}’s post' },
  quotePolicyChange: { id: 'status.quote_policy_change', defaultMessage: 'Change who can quote' },
});

const mapStateToProps = (state, { status }) => {
  const quotedStatusId = status.getIn(['quote', 'quoted_status']);
  return ({
    relationship: state.getIn(['relationships', status.getIn(['account', 'id'])]),
    quotedAccountId: quotedStatusId ? state.getIn(['statuses', quotedStatusId, 'account']) : null,
  });
};


class StatusActionBar extends ImmutablePureComponent {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    identity: identityContextPropShape,
    status: ImmutablePropTypes.map.isRequired,
    relationship: ImmutablePropTypes.record,
    quotedAccountId: PropTypes.string,
    contextType: PropTypes.string,
    onReply: PropTypes.func,
    onFavourite: PropTypes.func,
    onDelete: PropTypes.func,
    onRevokeQuote: PropTypes.func,
    onQuotePolicyChange: PropTypes.func,
    onMute: PropTypes.func,
    onUnmute: PropTypes.func,
    onBlock: PropTypes.func,
    onUnblock: PropTypes.func,
    onBlockDomain: PropTypes.func,
    onUnblockDomain: PropTypes.func,
    onReport: PropTypes.func,
    onEmbed: PropTypes.func,
    onMuteConversation: PropTypes.func,
    onPin: PropTypes.func,
    onFilter: PropTypes.func,
    onAddFilter: PropTypes.func,
    onInteractionModal: PropTypes.func,
    withDismiss: PropTypes.bool,
    withCounters: PropTypes.bool,
    // The host puts Edit in the Ж menu instead (the Moments viewer).
    hideEdit: PropTypes.bool,
    scrollKey: PropTypes.string,
    intl: PropTypes.object.isRequired,
    ...WithRouterPropTypes,
  };

  // Avoid checking props that are functions (and whose equality will always
  // evaluate to false. See react-immutable-pure-component for usage.
  updateOnProps = [
    'status',
    'relationship',
    'quotedAccountId',
    'withDismiss',
  ];

  handleReplyClick = () => {
    const { signedIn } = this.props.identity;

    if (signedIn) {
      this.props.onReply(this.props.status);
    } else {
      this.props.onInteractionModal(this.props.status);
    }
  };

  handleShareClick = () => {
    navigator.share({
      url: this.props.status.get('url'),
    }).catch((e) => {
      if (e.name !== 'AbortError') console.error(e);
    });
  };

  handleFavouriteClick = () => {
    const { signedIn } = this.props.identity;

    if (signedIn) {
      this.props.onFavourite(this.props.status);
    } else {
      this.props.onInteractionModal(this.props.status);
    }
  };

  // A Mate's post on your profile: off it goes, though the post stays
  // theirs. The profile's list is refetched so it leaves at once.
  handleRemoveFromProfile = () => {
    const { status, dispatch } = this.props;

    api().delete(`/api/v1/statuses/${status.get('id')}/profile_post`).then((response) => {
      dispatch(importFetchedStatus(response.data));
      dispatch(clearTimeline(`account:${me}`));
      dispatch(expandAccountTimeline(me));
    }).catch((error) => {
      dispatch(showAlertForError(error));
    });
  };

  handleDeleteClick = () => {
    this.props.onDelete(this.props.status);
  };

  handleRedraftClick = () => {
    this.props.onDelete(this.props.status, true);
  };

  handleWhoCanSeeClick = () => {
    this.props.dispatch(openModal({
      modalType: 'STATUS_AUDIENCE',
      modalProps: { statusId: this.props.status.get('id') },
    }));
  };

  handleEditClick = () => {
    this.props.onEdit(this.props.status);
  };

  handlePinClick = () => {
    this.props.onPin(this.props.status);
  };

  handleMuteClick = () => {
    const { status, relationship, onMute, onUnmute } = this.props;
    const account = status.get('account');

    if (relationship && relationship.get('muting')) {
      onUnmute(account);
    } else {
      onMute(account);
    }
  };

  handleRevokeQuoteClick = () => {
    this.props.onRevokeQuote(this.props.status);
  };

  handleQuotePolicyChange = () => {
    this.props.onQuotePolicyChange(this.props.status);
  };

  handleBlockClick = () => {
    const { status, relationship, onBlock, onUnblock } = this.props;
    const account = status.get('account');

    if (relationship && relationship.get('blocking')) {
      onUnblock(account);
    } else {
      onBlock(status);
    }
  };

  handleBlockDomain = () => {
    const { status, onBlockDomain } = this.props;
    const account = status.get('account');

    onBlockDomain(account);
  };

  handleUnblockDomain = () => {
    const { status, onUnblockDomain } = this.props;
    const account = status.get('account');

    onUnblockDomain(account.get('acct').split('@')[1]);
  };

  handleOpen = () => {
    this.props.history.push(`/@${this.props.status.getIn(['account', 'acct'])}/${this.props.status.get('id')}`);
  };

  handleEmbed = () => {
    this.props.onEmbed(this.props.status);
  };

  handleReport = () => {
    this.props.onReport(this.props.status);
  };

  handleConversationMuteClick = () => {
    this.props.onMuteConversation(this.props.status);
  };

  handleFilterClick = () => {
    this.props.onAddFilter(this.props.status);
  };

  // Repost: a quote post. The composer opens with this post embedded and your
  // words above it (docs/decisions.md, 2026-11-08).
  handleRepostClick = () => {
    this.props.onQuote(this.props.status);
    this.props.history.push('/publish');
  };

  handleCopy = () => {
    const url = this.props.status.get('url');
    navigator.clipboard.writeText(url);
  };

  render () {
    const { status, intl, withCounters } = this.props;
    const writtenByMe = status.getIn(['account', 'id']) === me;
    // Anyone who can see a post can repost it (the server says so per viewer).
    const canRepost = ['automatic', 'manual'].includes(status.getIn(['quote_approval', 'current_user']));

    let replyIcon;
    let replyIconComponent;
    let replyTitle;

    if (status.get('in_reply_to_id', null) === null) {
      replyIcon = 'reply';
      replyIconComponent = ReplyIcon;
      replyTitle = intl.formatMessage(messages.reply);
    } else {
      replyIcon = 'reply-all';
      replyIconComponent = ReplyAllIcon;
      replyTitle = intl.formatMessage(messages.replyAll);
    }

    const favouriteTitle = intl.formatMessage(status.get('favourited') ? messages.removeFavourite : messages.favourite);
    const isReply = status.get('in_reply_to_account_id') === status.getIn(['account', 'id']);

    return (
      <div className='status__action-bar'>
        {/* Kronk action bar: Reply · Froth · Nudge (Edit on your own) ·
            Repost. No … menu (docs/decisions.md, 2026-11-08): Delete, who
            can see it and Pin live inside Edit. */}
        <div className='status__action-bar__button-wrapper'>
          <IconButton className='status__action-bar__button' title={replyTitle} icon={isReply ? 'reply' : replyIcon} iconComponent={isReply ? ReplyIcon : replyIconComponent} onClick={this.handleReplyClick} counter={status.get('replies_count')} />
        </div>
        <div className='status__action-bar__button-wrapper'>
          <IconButton className='status__action-bar__button star-icon' animate active={status.get('favourited')} title={favouriteTitle} icon='star' iconComponent={status.get('favourited') ? HeartIcon : HeartBorderIcon} onClick={this.handleFavouriteClick} />
          {/* The count opens who frothed it; the heart itself froths. */}
          {withCounters && (
            <Link
              className='icon-button__counter status__action-bar__froths'
              to={`/@${status.getIn(['account', 'acct'])}/${status.get('id')}/froths`}
              title={intl.formatMessage(messages.frothedBy)}
            >
              <AnimatedNumber value={status.get('favourites_count')} />
            </Link>
          )}
        </div>
        <div className='status__action-bar__button-wrapper'>
          {/* Nudge hides on your own posts (can't nudge yourself); reuse that
              slot for Edit (pencil) so the bar stays balanced. Same position,
              no layout shift. */}
          {writtenByMe ? (!this.props.hideEdit && (
            <IconButton
              className='status__action-bar__button'
              title={intl.formatMessage(messages.edit)}
              icon='pencil'
              iconComponent={EditIcon}
              onClick={this.handleEditClick}
            />
          )) : (
            <NudgeButton status={status} className='status__action-bar__button' />
          )}
        </div>
        {canRepost && (
          <div className='status__action-bar__button-wrapper'>
            <IconButton className='status__action-bar__button' title={intl.formatMessage(messages.repost)} icon='repeat' iconComponent={RepeatIcon} onClick={this.handleRepostClick} />
          </div>
        )}
      </div>
    );
  }

}

export default withRouter(withIdentity(connect(mapStateToProps)(injectIntl(StatusActionBar))));
