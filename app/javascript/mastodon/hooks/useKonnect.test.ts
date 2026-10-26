import { konnectSearch, parseKonnectParam } from './useKonnect';

describe('parseKonnectParam', () => {
  it('reads ?konnect=<slug>:<id>', () => {
    expect(parseKonnectParam('?konnect=krew:12')).toEqual({
      slug: 'krew',
      id: '12',
    });
  });

  it('reads the older ?krew=<id> as a Krew', () => {
    expect(parseKonnectParam('?krew=7')).toEqual({ slug: 'krew', id: '7' });
  });

  it('prefers ?konnect= when both are there', () => {
    expect(parseKonnectParam('?krew=7&konnect=albutts:3')).toEqual({
      slug: 'albutts',
      id: '3',
    });
  });

  it('ignores a malformed or missing value', () => {
    expect(parseKonnectParam('?konnect=krew')).toBeNull();
    expect(parseKonnectParam('?konnect=:12')).toBeNull();
    expect(parseKonnectParam('?konnect=krew:')).toBeNull();
    expect(parseKonnectParam('')).toBeNull();
  });

  it('round-trips what konnectSearch writes', () => {
    expect(konnectSearch('art', 42)).toBe('?konnect=art:42');
    expect(parseKonnectParam(konnectSearch('art', 42))).toEqual({
      slug: 'art',
      id: '42',
    });
  });
});
