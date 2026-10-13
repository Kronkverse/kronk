import { describe, expect, it } from 'vitest';

import { reorderWithin } from '../profile_kuestion_tiles';

const pins = (ids: string[]) => ids.map((question_id) => ({ question_id }));
const order = (list: { question_id: string }[]) =>
  list.map((p) => p.question_id);

describe('reorderWithin', () => {
  it('moves answers within their run and leaves the rest in place', () => {
    // a, c, e are one run (say the facts); b, d another.
    const all = pins(['a', 'b', 'c', 'd', 'e']);

    expect(order(reorderWithin(all, ['e', 'a', 'c']))).toEqual([
      'e',
      'b',
      'a',
      'd',
      'c',
    ]);
  });

  it('keeps the order when nothing moved', () => {
    const all = pins(['a', 'b', 'c']);

    expect(order(reorderWithin(all, ['a', 'c']))).toEqual(['a', 'b', 'c']);
  });
});
