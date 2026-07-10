import { useAppSelector } from 'mastodon/store';
import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';

// Returns the current user's profile sections, ordered by position.
// Empty until fetchProfileSections resolves.
export const useProfileSections = (): ApiProfileSectionJSON[] => {
  return useAppSelector((state) => {
    const sections = state.get('profile_sections') as
      | ApiProfileSectionJSON[]
      | undefined;
    return sections ?? [];
  });
};
