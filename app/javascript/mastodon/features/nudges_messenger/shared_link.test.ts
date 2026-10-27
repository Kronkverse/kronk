import { bodyWithLink, readSharedLink, withoutSharedLink } from './shared_link';

const shared = {
  attachStatusUrl: 'https://kronk.test/@ana/123',
  attachStatusBody: 'Hello there',
  attachStatusAuthorName: 'Ana',
  attachStatusAuthorAcct: 'ana',
  attachStatusAuthorAvatar: 'https://kronk.test/a.png',
};

describe('readSharedLink', () => {
  it('reads the link the Nudge button passes', () => {
    expect(readSharedLink(shared)).toEqual({
      url: 'https://kronk.test/@ana/123',
      body: 'Hello there',
      authorName: 'Ana',
      authorAcct: 'ana',
    });
  });

  it('is null without a link', () => {
    expect(readSharedLink(undefined)).toBeNull();
    expect(readSharedLink({ wachuneedListingId: '9' })).toBeNull();
    expect(readSharedLink({ attachStatusUrl: '  ' })).toBeNull();
  });

  it('copes with missing metadata', () => {
    expect(readSharedLink({ attachStatusUrl: 'https://x.test/hub/a' })).toEqual(
      {
        url: 'https://x.test/hub/a',
        body: null,
        authorName: null,
        authorAcct: null,
      },
    );
  });
});

describe('withoutSharedLink', () => {
  it('drops the link and keeps anything else', () => {
    expect(withoutSharedLink({ ...shared, wachuneedListingId: '9' })).toEqual({
      wachuneedListingId: '9',
    });
  });

  it('leaves no empty state behind', () => {
    expect(withoutSharedLink(shared)).toBeUndefined();
  });
});

describe('bodyWithLink', () => {
  const link = readSharedLink(shared);

  it('puts the link on its own last line', () => {
    expect(bodyWithLink(' look at this ', link)).toBe(
      'look at this\nhttps://kronk.test/@ana/123',
    );
  });

  it('sends the link alone when nothing was typed', () => {
    expect(bodyWithLink('  ', link)).toBe('https://kronk.test/@ana/123');
  });

  it('is just the text without a link', () => {
    expect(bodyWithLink(' hi ', null)).toBe('hi');
  });
});
