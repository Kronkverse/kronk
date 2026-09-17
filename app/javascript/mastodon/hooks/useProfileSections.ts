import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import { useAppSelector } from 'mastodon/store';

// Returns the current user's profile sections, ordered by position.
// Empty until fetchProfileSections resolves.
//
// Read by property rather than `state.get(...)` — see hooks/useKorner.ts for
// why.
export const useProfileSections = (): ApiProfileSectionJSON[] => {
  return useAppSelector((state) => state.profile_sections);
};
