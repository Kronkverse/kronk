import { describe, expect, it } from 'vitest';

import type { KommonsNode } from './nodes';
import { SETTINGS_ROOT, mapNodes } from './nodes';

const node = (
  id: string,
  bucket: KommonsNode['bucket'],
  parent?: string,
): KommonsNode => ({
  id,
  bucket,
  parent,
  label: id,
  url: `/${id}`,
  lifecycle: 'live',
  openProposals: 0,
});

// The body-map draws platform destinations. The settings.* sub-pages ride in
// the `profile` bucket only so the settings nav can project them; on the map
// they were ten discs crowding Profile. mapNodes keeps `settings.root` as the
// single Settings destination and drops its children — every other node,
// including the real profile pages and the korner pages, passes through.
describe('mapNodes', () => {
  it('drops the settings sub-pages but keeps settings.root', () => {
    const nodes = [
      node('profile.view', 'profile'),
      node('profile.edit', 'profile'),
      node(SETTINGS_ROOT, 'profile'),
      node('settings.appearance', 'profile', SETTINGS_ROOT),
      node('settings.privacy', 'profile', SETTINGS_ROOT),
      node('settings.account', 'profile', SETTINGS_ROOT),
    ];

    const mapped = mapNodes(nodes)
      .map((n) => n.id)
      .sort();

    expect(mapped).toEqual(['profile.edit', 'profile.view', SETTINGS_ROOT]);
    expect(mapped).not.toContain('settings.appearance');
  });

  it('leaves nodes in other buckets untouched', () => {
    const nodes = [
      node('feed.home', 'feed'),
      node('kommons', 'hub'),
      node('kommons.proposals', 'hub', 'kommons'),
      node('nudges.all', 'nudges'),
    ];

    expect(mapNodes(nodes)).toEqual(nodes);
  });

  it('does not drop a settings.root that is itself parentless', () => {
    // settings.root belongs on the map — only its children are filtered. A
    // guard against keying the filter on the id prefix instead of the parent.
    const nodes = [node(SETTINGS_ROOT, 'profile')];

    expect(mapNodes(nodes)).toHaveLength(1);
  });
});
