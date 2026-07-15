import {
  apiRequestGet,
  apiRequestPut,
  apiRequestPost,
  apiRequestDelete,
} from 'mastodon/api';

export interface ApiProfileSectionJSON {
  id: string;
  // `string` covers future-forward compat; the known values are
  // documented here so consumers can narrow with a `switch` on the
  // literals.
  section_type: string; // 'timeline' | 'korner' | 'kategory' | ...
  position: number;
  title: string | null;
  settings: Record<string, unknown>;
  visible: boolean;
}

export const apiGetProfileSections = () =>
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
