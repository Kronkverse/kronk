import { apiRequestGet } from 'mastodon/api';

export interface ApiToldPresetJSON {
  card_type: string;
  already_added: boolean;
}

export interface ApiDrawnPresetJSON {
  // Names the shelf: its korner, or korner:source for one drawn some other
  // way than your own posts ('albutts:tagged', the photos you're tagged in).
  key: string;
  korner_slug: string;
  source?: string;
  name: string;
  card: string;
  source_label: string;
  count: number;
  already_added: boolean;
}

export interface ApiProfileLibraryJSON {
  told: ApiToldPresetJSON[];
  drawn: ApiDrawnPresetJSON[];
}

export const apiGetProfileLibrary = () =>
  apiRequestGet<ApiProfileLibraryJSON>('v1/profile/library');

// The key a shelf answers to, matching ApiDrawnPresetJSON#key.
export const shelfKeyOf = (settings: Record<string, unknown>) => {
  const slug = settings.korner_slug as string | undefined;
  const source = settings.source as string | undefined;
  return slug && source ? `${slug}:${source}` : slug;
};

// The glyph a shelf's tile draws: its korner's, except the Gallery
// ('profile:media'), which isn't a korner and draws a grid of photos.
export const glyphSlugOf = (preset: {
  korner_slug: string;
  source?: string;
}) => (preset.source === 'media' ? 'gallery' : preset.korner_slug);
