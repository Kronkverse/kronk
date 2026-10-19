import { apiRequestGet } from 'mastodon/api';

// What a link to something on Kronk shows, as the person viewing sees it
// (app/lib/kronk/link_preview.rb). `null` when the link isn't to a thing on
// Kronk, the thing is gone, or the viewer can't see it.
export interface ApiLinkPreview {
  korner: string;
  title: string | null;
  summary: string | null;
  image: string | null;
  when: string | null;
  url: string;
}

export const apiLinkPreviews = (urls: string[]) =>
  apiRequestGet<{ url: string; preview: ApiLinkPreview | null }[]>(
    'v1/link_previews',
    { urls },
  );
