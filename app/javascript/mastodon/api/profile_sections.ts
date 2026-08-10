import {
  apiRequestGet,
  apiRequestPut,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';

export interface ApiProfileSectionJSON {
  id: string;
  // `string` covers future-forward compat; on the shelved profile
  // (post-2026-08-01) every row is `drawn`. Legacy values still
  // present pre-migration are `timeline` / `korner` / `kategory` /
  // `text`.
  section_type: string;
  // Alias for `section_type` — matches the frontend copy ("shelves").
  kind?: string;
  position: number;
  title: string | null;
  // `settings.render` picks the client render component
  // (album / track / trek / longform / listing / photo / answers /
  // moment / chips / korner). `settings.korner_slug`, `tag_name`,
  // `order` ('newest' | 'oldest' | 'chosen'), `order_ids`, `pins`,
  // `hides` all live here too.
  settings: Record<string, unknown>;
  visible: boolean;
  // Reach ladder shared with ProfileCard (five scopes).
  visibility?: 'self_only' | 'mates' | 'orbit' | 'public';
}

export const apiGetOwnProfileSections = () =>
  apiRequestGet<ApiProfileSectionJSON[]>('v1/profile/sections');

export const apiReorderProfileSections = (order: string[]) =>
  apiRequestPut<ApiProfileSectionJSON[]>('v1/profile/sections/reorder', {
    order,
  });

export const apiCreateProfileSection = (params: {
  section_type: string;
  title?: string | null;
  settings?: Record<string, unknown>;
}) => apiRequestPost<ApiProfileSectionJSON>('v1/profile/sections', params);

export const apiUpdateProfileSection = (
  id: string,
  params: {
    title?: string | null;
    visible?: boolean;
    settings?: Record<string, unknown>;
  },
) => apiRequestPut<ApiProfileSectionJSON>(`v1/profile/sections/${id}`, params);

export const apiDeleteProfileSection = (id: string) =>
  apiRequestDelete(`v1/profile/sections/${id}`);

// Viewer side — another account's visible drawn shelves (or your own,
// filtered).
export const apiGetProfileSections = (accountId: string) =>
  apiRequestGet<ApiProfileSectionJSON[]>(
    `v1/accounts/${accountId}/profile/sections`,
  );
