import PropTypes from 'prop-types';
import { PureComponent } from 'react';

import { FormattedMessage } from 'react-intl';

import ImmutablePropTypes from 'react-immutable-proptypes';
import { connect } from 'react-redux';

import {
  unfollowAccount,
  muteAccount,
  blockAccount,
} from 'mastodon/actions/accounts';
import { Button } from 'mastodon/components/button';

const mapStateToProps = () => ({});

class Thanks extends PureComponent {

  static propTypes = {
    submitted: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    account: ImmutablePropTypes.record.isRequired,
    dispatch: PropTypes.func.isRequired,
  };

  handleCloseClick = () => {
    const { onClose } = this.props;
    onClose();
  };

  handleUnfollowClick = () => {
    const { dispatch, account, onClose } = this.props;
    dispatch(unfollowAccount(account.get('id')));
    onClose();
  };

  handleMuteClick = () => {
    const { dispatch, account, onClose } = this.props;
    dispatch(muteAccount(account.get('id')));
    onClose();
  };

  handleBlockClick = () => {
    const { dispatch, account, onClose } = this.props;
    dispatch(blockAccount(account.get('id')));
    onClose();
  };

  render () {
    const { account, submitted } = this.props;

    return (
      <>
        <h3 className='report-dialog-modal__title'>{submitted ? <FormattedMessage id='report.thanks.title_actionable' defaultMessage="Thanks for reporting, we'll look into this." /> : <FormattedMessage id='report.thanks.title' defaultMessage="Don't want to see this?" />}</h3>
        <p className='report-dialog-modal__lead'>{submitted ? <FormattedMessage id='report.thanks.take_action_actionable' defaultMessage='While we review this, you can take action against @{name}:' values={{ name: account.get('username') }} /> : <FormattedMessage id='report.thanks.take_action' defaultMessage='Here are your options for controlling what you see on Kronk:' />}</p>

        {account.getIn(['relationship', 'following']) && (
          <>
            <h4 className='report-dialog-modal__subtitle'><FormattedMessage id='report.unfollow' defaultMessage='Remove @{name} as a Mate' values={{ name: account.get('username') }} /></h4>
            <p className='report-dialog-modal__lead'><FormattedMessage id='report.unfollow_explanation' defaultMessage='You’re Mates with this account. To stop seeing their posts in your feed, remove them as a Mate.' /></p>
            <Button secondary onClick={this.handleUnfollowClick}><FormattedMessage id='report.remove_mate' defaultMessage='Remove Mate' /></Button>
            <hr />
          </>
        )}

        <h4 className='report-dialog-modal__subtitle'><FormattedMessage id='account.mute' defaultMessage='Mute @{name}' values={{ name: account.get('username') }} /></h4>
        <p className='report-dialog-modal__lead'><FormattedMessage id='report.mute_explanation' defaultMessage='You won’t see their posts. They can still see yours and won’t know they’re muted.' /></p>
        <Button secondary onClick={this.handleMuteClick}>{!account.getIn(['relationship', 'muting']) ? <FormattedMessage id='report.mute' defaultMessage='Mute' /> : <FormattedMessage id='account.muted' defaultMessage='Muted' />}</Button>

        <hr />

        <h4 className='report-dialog-modal__subtitle'><FormattedMessage id='account.block' defaultMessage='Block @{name}' values={{ name: account.get('username') }} /></h4>
        <p className='report-dialog-modal__lead'><FormattedMessage id='report.block_explanation' defaultMessage='You won’t see their posts. They won’t be able to see your posts or be your Mate. They’ll be able to tell they’re blocked.' /></p>
        <Button secondary onClick={this.handleBlockClick}>{!account.getIn(['relationship', 'blocking']) ? <FormattedMessage id='report.block' defaultMessage='Block' /> : <FormattedMessage id='account.blocked' defaultMessage='Blocked' />}</Button>

        <div className='flex-spacer' />

        <div className='report-dialog-modal__actions'>
          <Button onClick={this.handleCloseClick}><FormattedMessage id='report.close' defaultMessage='Done' /></Button>
        </div>
      </>
    );
  }

}

export default connect(mapStateToProps)(Thanks);
