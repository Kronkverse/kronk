import { connect } from 'react-redux';

import { uploadCompose } from '../../../actions/compose';
import UploadButton from '../components/upload_button';

const mapStateToProps = state => {
  const isPoll = state.getIn(['compose', 'poll']) !== null;
  const isUploading = state.getIn(['compose', 'is_uploading']);
  const readyAttachmentsSize = state.getIn(['compose', 'media_attachments']).size ?? 0;
  const pendingAttachmentsSize = state.getIn(['compose', 'pending_media_attachments']).size ?? 0;
  const attachmentsSize = readyAttachmentsSize + pendingAttachmentsSize;
  const isOverLimit = attachmentsSize > state.getIn(['server', 'server', 'configuration', 'statuses', 'max_media_attachments'])-1;
  // Photos and videos mix in one post; an audio file still goes alone.
  const hasAudio = state.getIn(['compose', 'media_attachments']).some(m => m.get('type') === 'audio');
  const hasQuote = !!state.compose.get('quoted_status_id');

  return {
    disabled: isPoll || isUploading || isOverLimit || hasAudio || hasQuote,
    resetFileKey: state.getIn(['compose', 'resetFileKey']),
  };
};

const mapDispatchToProps = dispatch => ({

  onSelectFile(files) {
    dispatch(uploadCompose(files));
  },

});

export default connect(mapStateToProps, mapDispatchToProps)(UploadButton);
