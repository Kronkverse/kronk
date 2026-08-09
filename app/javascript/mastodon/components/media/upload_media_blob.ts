import api from 'mastodon/api';

// Upload an audio Blob (a `MediaRecorder` output, typically) to
// `/api/v2/media` and resolve to the returned MediaAttachment ID.
//
// Format handling: the `file` command reads a container, not an intent,
// so an audio-only MP4 or WebM is detected as `video/mp4` / `video/webm`.
// Declaring the blob as `audio/*` then trips Paperclip's spoof detector
// on the major-type mismatch (audio vs video) → 422. We therefore declare
// the mp4- and webm-container clips as their `video/*` type (still valid;
// they route through the video transcoder), matching what `file` sees.
// Ogg is the exception — `file` reports `audio/ogg`, so it goes as-is.
//
// Extracted from the archived nudges/voices.tsx so any component
// producing a browser-recorded audio Blob can drop it here without
// re-learning the extension-vs-mime dance.
export async function uploadMediaBlob(blob: Blob): Promise<string> {
  let uploadType: string;
  let ext: string;
  if (blob.type.startsWith('audio/ogg')) {
    uploadType = 'audio/ogg';
    ext = 'ogg';
  } else if (
    blob.type.startsWith('audio/mp4') ||
    blob.type.startsWith('audio/x-m4a')
  ) {
    uploadType = 'video/mp4';
    ext = 'mp4';
  } else {
    uploadType = 'video/webm';
    ext = 'webm';
  }
  const form = new FormData();
  form.append('file', new File([blob], `voice.${ext}`, { type: uploadType }));
  const { data } = await api().post<{ id: string }>('/api/v2/media', form);
  return data.id;
}
