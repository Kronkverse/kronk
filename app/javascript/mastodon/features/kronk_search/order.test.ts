import { spaceFirst } from './order';

const rows = [
  { key: 'post', korner: 'feed' },
  { key: 'listing-1', korner: 'wachuneed' },
  { key: 'kategory', korner: undefined },
  { key: 'listing-2', korner: 'wachuneed' },
];

describe('spaceFirst', () => {
  it('puts the results of the space searched from first, in the order they had', () => {
    const { here, elsewhere } = spaceFirst(rows, 'wachuneed');

    expect(here.map((row) => row.key)).toEqual(['listing-1', 'listing-2']);
    expect(elsewhere.map((row) => row.key)).toEqual(['post', 'kategory']);
  });

  it('leaves the list as it is when searching from nowhere in particular', () => {
    expect(spaceFirst(rows, null)).toEqual({ here: [], elsewhere: rows });
  });

  it('has nothing to put first when the space has no results', () => {
    expect(spaceFirst(rows, 'booth').here).toEqual([]);
  });
});
