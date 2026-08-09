import { useCallback } from 'react';

import { uploadCompose } from 'mastodon/actions/compose';
import { VoiceRecorder, voiceBlobToFile } from 'mastodon/components/media';
import type { VoiceRecorderChange } from 'mastodon/components/media';
import { useAppDispatch } from 'mastodon/store';

// Inline voice recorder for the composer body, toggled by the mic button in the
// tool drawer. A finished clip is dropped into the post as a normal media
// attachment via uploadCompose — the same path the paperclip uses — so it rides
// the standard media_ids flow on submit; the recorder then closes and the clip
// shows in the upload row like any other attachment.

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ComposeVoiceRecorder: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();

  const handleChange = useCallback(
    (change: VoiceRecorderChange | null) => {
      if (!change?.blob) return;
      // voiceBlobToFile owns the container-vs-MIME dance (mp4/webm audio must
      // be declared video/* or Paperclip 422s the spoof check).
      dispatch(uploadCompose([voiceBlobToFile(change.blob)]));
      onClose();
    },
    [dispatch, onClose],
  );

  if (!open) return null;

  return (
    <div className='compose-form__voice-recorder'>
      <VoiceRecorder autoUpload={false} onChange={handleChange} />
    </div>
  );
};
