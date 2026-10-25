import { setKornerSeen, setKornerTunedIn } from 'mastodon/actions/korners';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { selectUnreadKornerCounts } from 'mastodon/selectors/korners';
import type { RootState } from 'mastodon/store';

import { kornersReducer } from './korners';

const korner = (slug: string, unread?: number): ApiKornerJSON => ({
  slug,
  name: slug,
  unread_count: unread,
});

const stateWith = (
  ...korners: ApiKornerJSON[]
): Record<string, ApiKornerJSON> =>
  Object.fromEntries(korners.map((k) => [k.slug, k]));

describe('kornersReducer / setKornerSeen', () => {
  test('clears the count to 0 when the whole korner is opened (all)', () => {
    const next = kornersReducer(
      stateWith(korner('moments', 3)),
      setKornerSeen({ slug: 'moments', all: true }),
    );
    expect(next.moments?.unread_count).toBe(0);
  });

  test('decrements by one when a single post is seen', () => {
    const next = kornersReducer(
      stateWith(korner('moments', 3)),
      setKornerSeen({ slug: 'moments' }),
    );
    expect(next.moments?.unread_count).toBe(2);
  });

  test('never decrements below 0', () => {
    const next = kornersReducer(
      stateWith(korner('moments', 0)),
      setKornerSeen({ slug: 'moments' }),
    );
    expect(next.moments?.unread_count).toBe(0);
  });

  test('is a no-op for an unknown slug', () => {
    const next = kornersReducer(
      stateWith(korner('moments', 3)),
      setKornerSeen({ slug: 'nope' }),
    );
    expect(next.moments?.unread_count).toBe(3);
  });

  test('leaves the tune-in reducer path untouched', () => {
    const next = kornersReducer(
      stateWith(korner('moments', 3)),
      setKornerTunedIn({ slug: 'moments', tunedIn: false }),
    );
    expect(next.moments?.unread_count).toBe(3);
    expect(next.moments?.tuned_in).toBe(false);
  });
});

describe('selectUnreadKornerCounts', () => {
  test('returns only korners with a positive unread count', () => {
    const state = {
      korners: stateWith(
        korner('moments', 2),
        korner('kommons', 0),
        korner('kalendar'),
        korner('booth', 5),
      ),
    } as unknown as RootState;

    expect(selectUnreadKornerCounts(state)).toEqual({ moments: 2, booth: 5 });
  });
});
