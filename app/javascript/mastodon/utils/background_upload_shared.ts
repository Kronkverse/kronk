// What the page and the service worker agree on for a background upload
// (utils/background_upload, service_worker/background_upload.js): where
// the worker leaves the server's answer for the page to pick up.

export const BG_UPLOAD_CACHE = 'kronk-bg-uploads';
export const BG_UPLOAD_ID_PREFIX = 'kronk-upload-';
export const BG_UPLOAD_MESSAGE = 'kronk:bg-upload';

export const bgUploadStashUrl = (id: string) => `/__bg-upload/${id}`;

// The server's answer, as the worker read it. `failure` is the background
// fetch's failureReason when there is no answer to give.
export interface BgUploadOutcome {
  status?: number;
  data?: unknown;
  failure?: string;
}
