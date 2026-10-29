// Saving a photo or video from a viewer without leaving the page.
//
// The viewers' Download link goes to `/media/:id/download`, which answers
// with a redirect to the file and `Content-Disposition: attachment`. On iOS
// that opens a preview page in place of the app, and you lose your place.
// So instead: fetch the file in the background and hand it over here.
//
// - On a phone that can share files, the share sheet (Save Image, Save to
//   Files...).
// - Otherwise a download from the fetched bytes (a blob URL with
//   `download`, which works because it is same-origin).
// - If the fetch fails, the old link, so it is never worse than before.
//
// The fetch reads the media host (`url`), which allows any origin. The
// redirect target of `/media/:id/download` is the storage bucket itself,
// which sends no CORS headers, so it can't be read from script.

interface DownloadMediaOptions {
  // The file on the media host (an attachment's `url`).
  url: string;
  // Same-origin route that answers with `Content-Disposition: attachment`.
  fallbackUrl: string;
  // The attachment id, for the file name.
  id: string;
}

const extensionOf = (url: string): string => {
  try {
    const match = /\.[a-z0-9]{1,5}$/i.exec(new URL(url).pathname);
    return match ? match[0].toLowerCase() : '';
  } catch {
    return '';
  }
};

const clickLink = (href: string, filename?: string) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename ?? '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// A phone, where a share sheet is how you save a photo. A desktop browser
// that can share files (Safari on a Mac, Chrome on Windows) still downloads.
const prefersShare = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

export const downloadMedia = async ({
  url,
  fallbackUrl,
  id,
}: DownloadMediaOptions): Promise<void> => {
  let blob: Blob;

  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    blob = await response.blob();
  } catch {
    clickLink(fallbackUrl);
    return;
  }

  const filename = `kronk-${id}${extensionOf(url)}`;

  if (prefersShare() && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        // Closing the share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        // Anything else (the tap's permission ran out while fetching, say):
        // download it instead.
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  clickLink(objectUrl, filename);
  // Long enough for the browser to start the download.
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
};

interface DownloadClick {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  currentTarget: { href: string };
  preventDefault: () => void;
}

interface DownloadableMedia {
  type: string;
  url: string;
  id: string;
}

// The viewers' Download link: a plain tap on a photo saves it in place.
// Anything else (a video, a modified click) follows the link as before.
export const handleMediaDownloadClick = (
  e: DownloadClick,
  media: DownloadableMedia | undefined,
) => {
  if (
    !media ||
    media.type !== 'image' ||
    e.button !== 0 ||
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey
  ) {
    return;
  }

  e.preventDefault();
  void downloadMedia({
    url: media.url,
    fallbackUrl: e.currentTarget.href,
    id: media.id,
  });
};
