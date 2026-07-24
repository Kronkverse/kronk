import PropTypes from 'prop-types';

import { defineMessages, injectIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';

import ImmutablePropTypes from 'react-immutable-proptypes';
import ImmutablePureComponent from 'react-immutable-pure-component';
import { connect } from 'react-redux';

import { debounce } from 'lodash';

import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';

import { fetchMateRequests, expandMateRequests } from '../../actions/accounts';
import ScrollableList from '../../components/scrollable_list';
import Column from '../ui/components/column';

import AccountAuthorizeContainer from './containers/account_authorize_container';

// Kronk — Mates. The dedicated Requests view: incoming Mate requests with
// Accept / Decline (docs/kronk_feed_and_reach.md §1). Mirrors the legacy
// follow-requests screen, minus the "unlocked account" explanation — a Mate
// request is always an explicit ask.

const messages = defineMessages({
  heading: { id: 'column.mate_requests', defaultMessage: 'Mate requests' },
});

const mapStateToProps = state => ({
  accountIds: state.getIn(['user_lists', 'mate_requests', 'items']),
  isLoading: state.getIn(['user_lists', 'mate_requests', 'isLoading'], true),
  hasMore: !!state.getIn(['user_lists', 'mate_requests', 'next']),
});

class MateRequests extends ImmutablePureComponent {

  static propTypes = {
    params: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    hasMore: PropTypes.bool,
    isLoading: PropTypes.bool,
    accountIds: ImmutablePropTypes.list,
    intl: PropTypes.object.isRequired,
    multiColumn: PropTypes.bool,
  };

  UNSAFE_componentWillMount () {
    this.props.dispatch(fetchMateRequests());
  }

  handleLoadMore = debounce(() => {
    this.props.dispatch(expandMateRequests());
  }, 300, { leading: true });

  render () {
    const { intl, accountIds, hasMore, multiColumn, isLoading } = this.props;

    const emptyMessage = <FormattedMessage id='empty_column.mate_requests' defaultMessage="You don't have any Mate requests yet. When someone asks to be your Mate, it will show up here." />;

    return (
      <Column bindToDocument={!multiColumn} icon='user-plus' iconComponent={PersonAddIcon} heading={intl.formatMessage(messages.heading)} alwaysShowBackButton>
        <ScrollableList
          scrollKey='mate_requests'
          onLoadMore={this.handleLoadMore}
          hasMore={hasMore}
          isLoading={isLoading}
          showLoading={isLoading && accountIds.size === 0}
          emptyMessage={emptyMessage}
          bindToDocument={!multiColumn}
        >
          {accountIds.map(id =>
            <AccountAuthorizeContainer key={id} id={id} />,
          )}
        </ScrollableList>

        <Helmet>
          <meta name='robots' content='noindex' />
        </Helmet>
      </Column>
    );
  }

}

export default connect(mapStateToProps)(injectIntl(MateRequests));
