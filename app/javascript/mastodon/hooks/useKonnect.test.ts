import {
  draftKonnections,
  konnectSearch,
  parseKonnectParam,
  restorableKonnections,
} from './useKonnect';

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

describe('draftKonnections', () => {
  const event = { slug: 'kalendar', id: '5', title: 'Ember' };
  const krew = { slug: 'krew', id: '9', title: 'Ember' };
  const source = { slug: 'kalendar', id: '5' };

  it('keeps everything when not opened from a record', () => {
    expect(draftKonnections([event, krew], null)).toEqual([event, krew]);
  });

  it('leaves out the record the composer was opened from', () => {
    // New film from the Ember event: the draft must not come back
    // Konnected to it when New film is opened on its own.
    expect(draftKonnections([event, krew], source)).toEqual([krew]);
  });

  it('leaves nothing when the source is all there is', () => {
    expect(draftKonnections([event], source)).toEqual([]);
  });

  it('keeps a record with the same id in another korner', () => {
    const album = { slug: 'albutts', id: '5' };
    expect(draftKonnections([album], source)).toEqual([album]);
  });

  it('drops the Same as mark with the source', () => {
    const leading = { ...event, same: true };
    expect(draftKonnections([leading, krew], source)).toEqual([krew]);
  });
});

describe('restorableKonnections', () => {
  const event = { slug: 'kalendar', id: '5' };
  const krew = { slug: 'krew', id: '9' };
  const source = { slug: 'kalendar', id: '5' };

  it('puts back what a draft kept', () => {
    expect(restorableKonnections([event, krew], 'cinema', null)).toEqual([
      event,
      krew,
    ]);
  });

  it('drops one in the composer’s own korner', () => {
    expect(restorableKonnections([event, krew], 'krew', null)).toEqual([event]);
  });

  it('drops the source, which the URL already gives', () => {
    expect(restorableKonnections([event, krew], 'cinema', source)).toEqual([
      krew,
    ]);
  });

  it('reads a missing list as none', () => {
    expect(restorableKonnections(undefined, 'cinema', null)).toEqual([]);
    expect(restorableKonnections(null, 'cinema', null)).toEqual([]);
  });
});
