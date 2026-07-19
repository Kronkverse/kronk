// @vitest-environment jsdom
//
// A smoke test, deliberately shallow. The map's real failures are visual and
// no assertion here will catch them — but a render test does catch the class
// of bug that has bitten this feature twice: a symbol left behind by a
// refactor. Vite transpiles without typechecking, and the project typecheck
// is currently red with unrelated errors, so a ReferenceError in this feature
// reaches the browser looking exactly like a successful build.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BodyMap } from './body_map';
import type { KommonsNode } from '../data/nodes';

const nodes: KommonsNode[] = [
  { id: 'f1', bucket: 'feed', label: 'Home', url: '/', lifecycle: 'live', openProposals: 2 },
  { id: 'p1', bucket: 'profile', label: 'Me', url: '/@u', lifecycle: 'live', openProposals: 0 },
  { id: 'k1', bucket: 'hub', parent: 'kommons', label: 'Seeds', url: '/hub/kommons', lifecycle: 'live', openProposals: 4 },
];

describe('BodyMap', () => {
  it('renders without throwing', () => {
    const { container } = render(
      <BodyMap nodes={nodes} path={['root']} onFocus={() => undefined} onOpenLeaf={() => undefined} />,
    );
    expect(container.querySelectorAll('.skel-node').length).toBeGreaterThan(0);
  });
});
