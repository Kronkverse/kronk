import { injectIntl } from 'react-intl';

import { connect } from 'react-redux';

import Status from '../components/status';
import { makeGetStatus, makeGetPictureInPicture } from '../selectors';

import { statusDispatchToProps } from './status_dispatch';

const makeMapStateToProps = () => {
  const getStatus = makeGetStatus();
  const getPictureInPicture = makeGetPictureInPicture();

  const mapStateToProps = (state, props) => ({
    status: getStatus(state, props),
    nextInReplyToId: props.nextId ? state.getIn(['statuses', props.nextId, 'in_reply_to_id']) : null,
    pictureInPicture: getPictureInPicture(state, props),
  });

  return mapStateToProps;
};

export default injectIntl(connect(makeMapStateToProps, statusDispatchToProps)(Status));
