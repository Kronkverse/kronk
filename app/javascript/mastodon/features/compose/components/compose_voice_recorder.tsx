import { useCallback } from 'react';

import { uploadCompose } from 'mastodon/actions/compose';
import { VoiceRecorder } from 'mastodon/components/media';
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
      const type = change.blob.type || 'audio/webm';
      const ext = type.includes('ogg')
        ? 'ogg'
        : type.includes('mp4') || type.includes('mpeg')
          ? 'm4a'
          : 'webm';
      const file = new File([change.blob], `voice.${ext}`, { type });
      dispatch(uploadCompose([file]));
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
