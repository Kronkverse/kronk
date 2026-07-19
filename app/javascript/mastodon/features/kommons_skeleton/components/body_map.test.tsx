// @vitest-environment jsdom
//
// A smoke test, deliberately shallow. The map's real failures are visual and
// no assertion here will catch them — but a render test does catch the class
// of bug that has bitten this feature twice: a symbol left behind by a
// refactor. Vite transpiles without typechecking, and the project typecheck
// is currently red with unrelated errors, so a ReferenceError in this feature
// reaches the browser looking exactly like a successful build.
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  // The map distinguishes a tap from the end of a pan with a flag set during
  // drag. That flag has to be cleared when a press lands on a node, or it
  // stays set from the last pan and swallows every tap that follows —
  // navigation dies silently the first time you move the camera by hand, and
  // the map still looks perfectly fine.
  it('still navigates after the canvas has been panned', () => {
    const onFocus = vi.fn();
    const { container } = render(
      <BodyMap nodes={nodes} path={['root']} onFocus={onFocus} onOpenLeaf={() => undefined} />,
    );

    const stage = container.querySelector('.skel-stage')!;
    fireEvent.pointerDown(stage, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 480, clientY: 340 });
    fireEvent.pointerUp(window);

    const limb = container.querySelector('.skel-node[class*="--d1"]')!;
    fireEvent.pointerDown(limb, { clientX: 200, clientY: 200 });
    fireEvent.click(limb);

    expect(onFocus).toHaveBeenCalled();
  });
});
