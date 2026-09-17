import { apiRequestGet } from 'mastodon/api';

export interface ApiToldPresetJSON {
  card_type: string;
  already_added: boolean;
}

export interface ApiDrawnPresetJSON {
  korner_slug: string;
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
