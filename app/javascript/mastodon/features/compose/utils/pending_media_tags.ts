// Module-level store for tags placed during compose.
// Avoids modifying the Immutable-based compose Redux state.
// Cleared automatically after each successful status submission.

export interface PendingTag {
  accountId: string;
  accountName: string;
  x: number;
  y: number;
}

const store = new Map<string, PendingTag[]>();

export const getPendingTags = (mediaId: string): PendingTag[] =>
  store.get(mediaId) ?? [];

export const setPendingTags = (mediaId: string, tags: PendingTag[]): void => {
  if (tags.length === 0) {
    store.delete(mediaId);
  } else {
    store.set(mediaId, tags);
  }
};

export const getAllPendingTags = (): Map<string, PendingTag[]> =>
  new Map(store);

export const clearAllPendingTags = (): void => {
  store.clear();
};
