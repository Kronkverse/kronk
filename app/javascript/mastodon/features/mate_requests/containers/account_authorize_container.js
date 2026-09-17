import { connect } from 'react-redux';

import { acceptMateRequest, rejectMateRequest } from '../../../actions/accounts';
import { makeGetAccount } from '../../../selectors';
import AccountAuthorize from '../components/account_authorize';

const makeMapStateToProps = () => {
  const getAccount = makeGetAccount();

  const mapStateToProps = (state, props) => ({
    account: getAccount(state, props.id),
  });

  return mapStateToProps;
};

const mapDispatchToProps = (dispatch, { id }) => ({
  onAuthorize () {
    dispatch(acceptMateRequest(id));
  },

  onReject () {
    dispatch(rejectMateRequest(id));
  },
});

export default connect(makeMapStateToProps, mapDispatchToProps)(AccountAuthorize);
