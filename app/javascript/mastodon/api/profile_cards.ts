import {
  apiRequestGet,
  apiRequestPut,
  apiRequestDelete,
} from 'mastodon/api';

// Owner-authored identity content on a profile — the "told" side of
// the shelved profile. Backend model: ProfileCard.
export interface ApiProfileCardJSON {
  id: string;
  card_type: string; // 'about' | 'interests' | 'values' | … ProfileCard::CARD_TYPES
  body: string;
  // 'block' (paragraphs) | 'chips' (tag list) | 'rail' (mini-cards).
  // The backend keeps this open; new renders can ship in a
  // pure-frontend PR once the client renders them.
  render: string;
  visibility: 'everyone' | 'kronk' | 'connections' | 'vouched' | 'only_me';
  position: number;
  visible: boolean;
}

// Owner (writer side) — cards you own.
export const apiGetOwnProfileCards = () =>
  apiRequestGet<ApiProfileCardJSON[]>('v1/profile/cards');

// Upsert by card_type (the URL is the slug).
export const apiUpsertProfileCard = (
  cardType: string,
  params: {
    body?: string;
    render?: string;
    visibility?: string;
    position?: number;
    visible?: boolean;
  },
) => apiRequestPut<ApiProfileCardJSON>(`v1/profile/cards/${cardType}`, params);

export const apiDeleteProfileCard = (cardType: string) =>
  apiRequestDelete(`v1/profile/cards/${cardType}`);

// Viewer side — someone else's visible cards (or your own, filtered).
export const apiGetProfileCards = (accountId: string) =>
  apiRequestGet<ApiProfileCardJSON[]>(
    `v1/accounts/${accountId}/profile/cards`,
  );
