import PropTypes from 'prop-types';

import { defineMessages, injectIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Redirect, withRouter } from 'react-router-dom';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { LoadingIndicator } from 'mastodon/components/loading_indicator';
import { ScrollContainer } from 'mastodon/containers/scroll_container';
import BundleColumnError from 'mastodon/features/ui/components/bundle_column_error';
import { PageActionRegistrar } from 'mastodon/features/ui/components/page_action_context';
import { identityContextPropShape, withIdentity } from 'mastodon/identity_context';
import { WithRouterPropTypes } from 'mastodon/utils/react_router';

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

  UNSAFE_componentWillMount () {
    this.props.dispatch(fetchStatus(this.props.params.statusId, { forceFetch: true }));
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
            <StatusQuoteManager id={status.get('id')} allReplies hideEdit />
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
