import { isKornerView, spaceSlugForPath } from '../kronk_menu';

// Which space's `about:` the i moon opens on each page.
describe('spaceSlugForPath', () => {
  it.each([
    ['/home', 'feed'],
    ['/home/mates', 'feed'],
    ['/home/settings', 'settings'],
    ['/@tal', 'profile'],
    ['/@tal/posts', 'profile'],
    ['/nudges', 'nudges'],
    ['/nudges/42', 'nudges'],
    ['/settings/appearance', 'settings'],
    ['/hub', 'hub'],
    ['/hub/settings', 'settings'],
    ['/hub/albutts', 'albutts'],
    ['/hub/albutts/a/7', 'albutts'],
    ['/hub/kommons/space/booth', 'kommons'],
    ['/welcome', 'welcome'],
  ])('%s belongs to %s', (path, slug) => {
    expect(spaceSlugForPath(path)).toBe(slug);
  });

  it.each(['/hub/search', '/kronk/governance', '/'])(
    '%s belongs to no space',
    (path) => {
      expect(spaceSlugForPath(path)).toBeNull();
    },
  );
});

// The + is a korner's own: on its views, never on one thing inside it.
describe('isKornerView', () => {
  const albutts = ['all', 'mine', 'contributed', 'mates'];

  it.each(['/hub/albutts', '/hub/albutts/', '/hub/albutts/mine'])(
    '%s is a view',
    (path) => {
      expect(isKornerView(path, albutts)).toBe(true);
    },
  );

  it.each([
    '/hub/albutts/albums/7',
    '/hub/albutts/composer',
    '/hub/albutts/mine/extra',
    '/hub/albutts/settings',
  ])('%s is not a view', (path) => {
    expect(isKornerView(path, albutts)).toBe(false);
  });

  it('treats a korner with no views as its landing only', () => {
    expect(isKornerView('/hub/moments', [])).toBe(true);
    expect(isKornerView('/hub/moments/42', [])).toBe(false);
  });
});
