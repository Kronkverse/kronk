import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, withRouter } from 'react-router-dom';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ScrollContainer } from 'mastodon/containers/scroll_container';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import { PageActionRegistrar } from 'mastodon/features/ui/components/page_action_context';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

import { importFetchedStatuses } from '../../actions/importer';
import { fetchStatus, editStatus } from '../../actions/statuses';
import { openModal } from '../../actions/modal';
import ColumnHeader from '../../components/column_header';
import { StatusQuoteManager } from '../../components/status_quoted';
import { makeGetStatus } from '../../selectors';
import Column from '../ui/components/column';

const messages = defineMessages({
  editPost: { id: 'status.page_action.edit', defaultMessage: 'Edit post' },
  statusTitleWithAttachments: { id: 'status.title.with_attachments', defaultMessage: '{user} posted {attachmentCount, plural, one {an attachment} other {# attachments}}' },
  detailedStatus: { id: 'status.detailed_status', defaultMessage: 'Detailed conversation view' },
  commentPostGone: { id: 'status.comment_post_gone', defaultMessage: 'The post this comment was on is gone.' },
});

const makeMapStateToProps = () => {
  const getStatus = makeGetStatus();

  const mapStateToProps = (state, props) => ({
    isLoading: state.getIn(['statuses', props.params.statusId, 'isLoading']),
    status: getStatus(state, { id: props.params.statusId, contextType: 'detailed' }),
    askReplyConfirmation: state.getIn(['compose', 'text']).trim().length !== 0,
  });

  return mapStateToProps;
};

const truncate = (str, num) => {
  const arr = Array.from(str);
  if (arr.length > num) {
    return arr.slice(0, num).join('') + '…';
  } else {
    return str;
  }
};

const titleFromStatus = (intl, status) => {
  const displayName = status.getIn(['account', 'display_name']);
  const username = status.getIn(['account', 'username']);
  const user = displayName.trim().length === 0 ? username : displayName;
  const text = status.get('search_index');
  const attachmentCount = status.get('media_attachments').size;

  return text ? `${user}: "${truncate(text, 30)}"` : intl.formatMessage(messages.statusTitleWithAttachments, { user, attachmentCount });
};

// A post's own page is the post exactly as it sits in the feed — the same
// card, with its replies and the reply box inside — just without the rest
// of the feed. The one difference: every reply shows, not the feed's first
// few.
//
// A comment has no page of its own (docs/spaces/feed.md (Comments)): its
// address opens the post at the top of its thread, with the comment picked
// out in the comment section (`?comment=`).
class Status extends ImmutablePureComponent {
  static propTypes = {
    identity: identityContextPropShape,
    params: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    status: ImmutablePropTypes.map,
    isLoading: PropTypes.bool,
    intl: PropTypes.object.isRequired,
    askReplyConfirmation: PropTypes.bool,
    multiColumn: PropTypes.bool,
    ...WithRouterPropTypes
  };

  state = {
    // For a comment: the post its thread starts at ({ id, acct }), `null`
    // when that post is gone, 'error' when the lookup failed.
    threadRoot: undefined,
    threadRootFor: null,
  };

  UNSAFE_componentWillMount () {
    this.props.dispatch(fetchStatus(this.props.params.statusId, { forceFetch: true }));
  }

  componentDidMount () {
    this.findThreadRoot();
  }

  componentDidUpdate () {
    this.findThreadRoot();
  }

  // `ancestors` come root first. If the first is itself a reply, the post
  // the thread started at has been deleted.
  findThreadRoot () {
    const { status, dispatch } = this.props;
    if (!status || !status.get('in_reply_to_id')) return;

    const id = status.get('id');
    if (this.state.threadRootFor === id) return;

    this.setState({ threadRootFor: id, threadRoot: undefined });

    api().get(`/api/v1/statuses/${id}/context`).then(({ data }) => {
      if (this.state.threadRootFor !== id) return;

      const root = data.ancestors[0];
      if (root && !root.in_reply_to_id) {
        dispatch(importFetchedStatuses([root]));
        this.setState({ threadRoot: { id: root.id, acct: root.account.acct } });
      } else {
        this.setState({ threadRoot: null });
      }
    }).catch(() => {
      if (this.state.threadRootFor === id) this.setState({ threadRoot: 'error' });
    });
  }

  UNSAFE_componentWillReceiveProps (nextProps) {
    if (nextProps.params.statusId !== this.props.params.statusId && nextProps.params.statusId) {
      this.props.dispatch(fetchStatus(nextProps.params.statusId, { forceFetch: true }));
    }
  }

  // The Ж menu's Edit moon (owner only) opens the same edit flow as the
  // card's Edit button.
  handleEditFromMenu = () => {
    const { dispatch, askReplyConfirmation, status } = this.props;

    if (askReplyConfirmation) {
      dispatch(openModal({ modalType: 'CONFIRM_EDIT_STATUS', modalProps: { statusId: status.get('id') } }));
    } else {
      dispatch(editStatus(status.get('id')));
    }
  };

  render () {
    const { isLoading, status, intl, multiColumn } = this.props;

    if (isLoading) {
      return (
        <Column>
          <LoadingIndicator />
        </Column>
      );
    }

    if (status === null) {
      return (
        <BundleColumnError multiColumn={multiColumn} errorType='routing' />
      );
    }

    // A post that only backs something a space owns (a Moment, an album
    // photo, a Kuestions answer) has nothing of its own to show here, so
    // go to where it lives. A location object: this app's router loses a
    // `?query` given inside a string.
    const kronkPage = status.get('kronk_page');
    if (kronkPage) {
      const [pathname, query] = kronkPage.split('?');
      return <Redirect to={{ pathname, search: query ? `?${query}` : '' }} />;
    }

    if (status.get('in_reply_to_id')) {
      const { threadRoot, threadRootFor } = this.state;

      if (threadRootFor !== status.get('id') || threadRoot === undefined) {
        return (
          <Column>
            <LoadingIndicator />
          </Column>
        );
      }

      if (threadRoot === 'error') {
        return <BundleColumnError multiColumn={multiColumn} errorType='network' />;
      }

      if (threadRoot === null) {
        return (
          <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.detailedStatus)}>
            <ColumnHeader showBackButton multiColumn={multiColumn} />
            <EmptyState title={intl.formatMessage(messages.commentPostGone)} />
          </Column>
        );
      }

      return <Redirect to={{ pathname: `/@${threadRoot.acct}/${threadRoot.id}`, search: `?comment=${status.get('id')}` }} />;
    }

    const highlightComment = new URLSearchParams(this.props.location.search).get('comment');

    const isLocal = status.getIn(['account', 'acct'], '').indexOf('@') === -1;
    const isIndexable = !status.getIn(['account', 'noindex']);

    return (
      <Column bindToDocument={!multiColumn} label={intl.formatMessage(messages.detailedStatus)}>
        <ColumnHeader showBackButton multiColumn={multiColumn} />

        <PageActionRegistrar
          action={{ key: 'edit', label: intl.formatMessage(messages.editPost), icon: EditIcon, iconId: 'edit' }}
          onClick={this.handleEditFromMenu}
          enabled={this.props.identity.signedIn && status.getIn(['account', 'id']) === this.props.identity.accountId}
        />

        <ScrollContainer scrollKey='thread'>
          <div className='item-list scrollable scrollable--flex'>
            {/* Edit is the Ж menu's on a detail page (docs/design.md). */}
            <StatusQuoteManager id={status.get('id')} allReplies detailed hideEdit withCounters highlightComment={highlightComment} />
          </div>
        </ScrollContainer>

        <Helmet>
          <title>{titleFromStatus(intl, status)}</title>
          <meta name='robots' content={(isLocal && isIndexable) ? 'all' : 'noindex'} />
          <link rel='canonical' href={status.get('url')} />
        </Helmet>
      </Column>
    );
  }

}

export default withRouter(injectIntl(connect(makeMapStateToProps)(withIdentity(Status))));
