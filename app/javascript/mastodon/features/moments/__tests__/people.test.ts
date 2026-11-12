import { groupMomentsByPerson } from '../people';

// Newest first, as the API returns them.
const moments = [
  { id: 'me-2', account: { id: 'me' } },
  { id: 'kai-2', account: { id: 'kai' } },
  { id: 'me-1', account: { id: 'me' } },
  { id: 'kai-1', account: { id: 'kai' } },
];

describe('groupMomentsByPerson', () => {
  it("starts someone else's at their oldest unseen Moment", () => {
    const seen = new Set(['kai-1']);
    const people = groupMomentsByPerson(moments, (m) => seen.has(m.id), {
      me: 'me',
    });

    expect(people.find((p) => p.accountId === 'kai')?.open.id).toBe('kai-2');
  });

  it('starts your own at your oldest, even when you have seen it', () => {
    const seen = new Set(['me-1']);
    const people = groupMomentsByPerson(moments, (m) => seen.has(m.id), {
      me: 'me',
    });

    expect(people.find((p) => p.accountId === 'me')?.open.id).toBe('me-1');
  });

  it('puts your own first when asked', () => {
    const people = groupMomentsByPerson(moments, () => false, {
      me: 'kai',
      meFirst: true,
    });

    expect(people.map((p) => p.accountId)).toEqual(['kai', 'me']);
  });
});
