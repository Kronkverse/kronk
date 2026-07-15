/* eslint-disable @typescript-eslint/no-unsafe-call --
 * Same story as `hooks/useKorner.ts` — state is an Immutable Map but
 * TypeScript sees the .get target as error-typed. Remove this
 * disable once the store types are proper. */

import type { ApiProfileSectionJSON } from 'mastodon/api/profile_sections';
import { useAppSelector } from 'mastodon/store';

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
