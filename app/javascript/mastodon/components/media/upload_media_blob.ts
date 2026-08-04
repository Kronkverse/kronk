import api from 'mastodon/api';

// Upload an audio Blob (a `MediaRecorder` output, typically) to
// `/api/v2/media` and resolve to the returned MediaAttachment ID.
//
// Format handling: Paperclip's spoof detector correctly identifies
// `audio/ogg` and `audio/mp4`, so those go through as-is. WebM,
// however, is always classified by the `file` command as `video/webm`
// — declaring it as `audio/webm` triggers a 422 mismatch. We spoof
// WebM as `video/webm` (still valid; routes through the video
// transcoder), which is why the extension is `webm` not `weba`.
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
    uploadType = 'audio/mp4';
    ext = 'm4a';
  } else {
    uploadType = 'video/webm';
    ext = 'webm';
  }
  const form = new FormData();
  form.append('file', new File([blob], `voice.${ext}`, { type: uploadType }));
  const { data } = await api().post<{ id: string }>('/api/v2/media', form);
  return data.id;
}
