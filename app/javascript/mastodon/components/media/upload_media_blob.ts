import api from 'mastodon/api';

// Build a correctly-typed `File` from a browser-recorded audio Blob.
//
// The `file` command reads a container, not an intent, so an audio-only MP4 or
// WebM is detected as `video/mp4` / `video/webm`. Declaring the blob as
// `audio/*` then trips Paperclip's spoof detector on the major-type mismatch
// (audio vs video) → 422. We therefore declare the mp4- and webm-container
// clips as their `video/*` type (still valid; they route through the video
// transcoder), matching what `file` sees. Ogg is the exception — `file`
// reports `audio/ogg`, so it goes as-is.
//
// Shared so every voice consumer builds the identical File: `uploadMediaBlob`
// below (direct /api/v2/media upload) and the compose store's `uploadCompose`
// path, plus the Nudge modal. Extracted from the archived nudges/voices.tsx.
export function voiceBlobToFile(blob: Blob): File {
  let type: string;
  let ext: string;
  if (blob.type.startsWith('audio/ogg')) {
    type = 'audio/ogg';
    ext = 'ogg';
  } else if (
    blob.type.startsWith('audio/mp4') ||
    blob.type.startsWith('audio/x-m4a')
  ) {
    type = 'video/mp4';
    ext = 'mp4';
  } else {
    type = 'video/webm';
    ext = 'webm';
  }
  return new File([blob], `voice.${ext}`, { type });
}

// Upload a browser-recorded audio Blob to `/api/v2/media` and resolve to the
// returned MediaAttachment ID. Uses `voiceBlobToFile` for the MIME dance.
export async function uploadMediaBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', voiceBlobToFile(blob));
  const { data } = await api().post<{ id: string }>('/api/v2/media', form);
  return data.id;
}
