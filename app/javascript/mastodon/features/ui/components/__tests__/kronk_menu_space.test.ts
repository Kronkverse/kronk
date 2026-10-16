import { spaceSlugForPath } from '../kronk_menu';

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
