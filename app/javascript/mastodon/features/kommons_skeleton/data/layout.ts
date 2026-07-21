// The Skeleton's spatial layout — pure functions, no React, no DOM.
//
// The map is a single static radial tree laid out once into world coordinates.
// Navigation never re-lays it out: a camera moves over it and nodes re-class
// for emphasis. That persistence is the whole design — every page keeps an
// absolute position you can learn, and you can always see the rest of the
// platform in your peripheral vision.
//
// Positions come from a recursive polar fan followed by an overlap relaxation.
// Children are fanned around the direction their branch is already travelling,
// so a limb grows outward instead of folding back on itself.

import type { KommonsNode } from './nodes';
import { bucketNodes, listKorners } from './nodes';

export const ROOT_ID = 'root';

// Listed in the order they appear around the body, clockwise from
// lower-right — because that order is what sets their angles. Arrow-key
// hopping follows this list too, so arrowing walks around the ring rather
// than jumping across it.
//
// This list must agree with `Kronk::NodeRegistry::BUCKETS` on the Ruby side;
// `layout.test.ts` asserts it. Deriving the limbs from the manifests instead
// is the point of docs/rebuild/decisions.md's one-mechanism decision.
export const LIMBS = [
  'hub',
  'nudges',
  'feed',
  'profile',
  'settings',
  'kronk',
] as const;
export type Limb = (typeof LIMBS)[number];

// Spread evenly rather than hand-placed. Four limbs at angles chosen for
// three left two tight pairs and two wide gaps; spacing them by construction
// means a fifth space re-spaces the body automatically instead of waiting for
// someone to notice it looks lopsided.
//
// Degrees, y growing downward, starting at 45° so the limbs sit in the
// diagonals: hub lower-right, nudges lower-left, feed upper-left, profile
// upper-right. That is within ~20° of where each already sat, so the
// positions stay learnable — the whole premise of the map is that a page
// keeps an absolute place you can remember.
const LIMB_SPREAD = 360 / LIMBS.length;
const LIMB_ANGLE: Record<Limb, number> = Object.fromEntries(
  LIMBS.map((limb, i) => [limb, 45 + i * LIMB_SPREAD]),
) as Record<Limb, number>;
const LIMB_RADIUS = 228;

// disc diameter, and the collision/framing box, per depth.
const DIM: Record<number, { d: number; w: number; h: number }> = {
  0: { d: 70, w: 110, h: 96 },
  1: { d: 84, w: 138, h: 114 },
  2: { d: 64, w: 124, h: 94 },
  3: { d: 54, w: 112, h: 84 },
  4: { d: 50, w: 108, h: 80 },
};

const rad = (deg: number) => (deg * Math.PI) / 180;

// Deterministic string hash in [0,1). The jitter it drives is what stops the
// tree looking mechanical — but it must be stable, or the map would rearrange
// itself on every reload and stop being learnable.
const hash = (s: string): number => {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return (x % 1000) / 1000;
};

export interface MapNode {
  id: string;
  label: string;
  parent?: string;
  kids: string[];
  url?: string;
  lifecycle?: string;
  count: number;
  // The slug of the korner this node IS (set on `korner:<slug>` nodes).
  korner?: string;
  // The slug of the space to open when this node is clicked, for pillars that
  // are a space in their own right (feed/profile/nudges/settings). Distinct
  // from `korner` so it doesn't make a pillar look like a Hub tenant.
  space?: string;
}

export interface Placed {
  cx: number;
  cy: number;
  w: number;
  h: number;
  disc: number;
  depth: number;
  ang: number;
}

export type Tree = Record<string, MapNode>;
export type Layout = Record<string, Placed>;

export interface World {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// ── Tree assembly ──────────────────────────────────────────────────────────
//
// Kronk's registry has no coordinates and no explicit root — nodes know only
// their bucket and parent korner. The tree is derived from that, so adding a
// korner or a page changes the map without anyone authoring a position.

export const buildTree = (nodes: KommonsNode[]): Tree => {
  const tree: Tree = {};
  const add = (n: MapNode) => {
    tree[n.id] = n;
  };

  add({ id: ROOT_ID, label: 'Kronk', kids: [...LIMBS], count: 0 });

  // These pillars are a space in their own right: clicking them opens a Space
  // page rather than drilling into internal pages. Hub is excluded (it contains
  // the korners — navigating would hide them); Kronk is excluded (org markdown
  // space, no manifest to drive a Space page yet).
  const SPACE_LIMBS = new Set(['feed', 'profile', 'nudges', 'settings']);
  for (const limb of LIMBS) {
    add({
      id: limb,
      label: limbLabel(limb),
      parent: ROOT_ID,
      kids: [],
      count: 0,
      space: SPACE_LIMBS.has(limb) ? limb : undefined,
    });
  }

  // feed/profile/nudges/settings hold their pages directly — but a page may
  // declare a `parent` that is another node in the same bucket (the settings.*
  // pages nest under `settings.root`), forming a sub-branch instead of piling up
  // flat under the limb. (hub is the general case of this: korners hold pages.)
  // Two passes — create every node, then wire each under its parent, falling
  // back to the limb when the parent isn't a node in this bucket.
  for (const limb of ['feed', 'profile', 'nudges', 'settings', 'kronk'] as const) {
    const inBucket = bucketNodes(nodes, limb);
    for (const n of inBucket) {
      add({
        id: n.id,
        label: n.label,
        parent: limb,
        kids: [],
        url: n.url,
        lifecycle: n.lifecycle,
        count: n.openProposals,
      });
    }
    for (const n of inBucket) {
      const node = tree[n.id];
      if (!node) continue;
      const parentId = n.parent && tree[n.parent] ? n.parent : limb;
      node.parent = parentId;
      tree[parentId]?.kids.push(n.id);
    }
  }

  // Anatomy: the Hub arm holds korners. Fingers are real, navigable pages —
  // parameterised routes (…/:id) are internal templates, not fingers. A korner
  // with one Finger stays a Finger itself (clicking opens its Space page); a
  // korner with several Fingers becomes a Hand that holds them and expands
  // (e.g. Kommons → Proposals / Skeleton / Proposer).
  for (const korner of listKorners(nodes)) {
    const kornerId = `korner:${korner.slug}`;
    const fingers = bucketNodes(nodes, 'hub', korner.slug).filter(
      (n) => n.url && !n.url.includes(':'),
    );
    const isHand = fingers.length > 1;
    add({
      id: kornerId,
      label: korner.label,
      parent: 'hub',
      kids: [],
      count: korner.openProposals,
      // A Hand has no destination of its own — it expands to its Fingers. A
      // single-page korner is a Finger that opens its Space page.
      korner: isHand ? undefined : korner.slug,
    });
    tree.hub?.kids.push(kornerId);

    if (isHand) {
      for (const n of fingers) {
        add({
          id: n.id,
          label: n.label,
          parent: kornerId,
          kids: [],
          url: n.url,
          lifecycle: n.lifecycle,
          count: n.openProposals,
        });
        tree[kornerId]?.kids.push(n.id);
      }
    }
  }

  // Hub's own pages (the grid, its settings) hang off the limb directly.
  for (const n of nodes.filter((x) => x.bucket === 'hub' && !x.parent)) {
    add({
      id: n.id,
      label: n.label,
      parent: 'hub',
      kids: [],
      url: n.url,
      lifecycle: n.lifecycle,
      count: n.openProposals,
    });
    tree.hub?.kids.push(n.id);
  }

  rollUp(tree, ROOT_ID);
  return tree;
};

const LIMB_LABEL: Record<Limb, string> = {
  feed: 'Feed',
  profile: 'Profile',
  nudges: 'Nudges',
  hub: 'Hub',
  settings: 'Settings',
  kronk: 'Kronk',
};

// A record rather than a ternary chain: the chain's final branch was an
// unconditional 'Hub', so adding a limb silently labelled it Hub instead of
// failing. A Record<Limb, string> cannot compile with a limb missing.
const limbLabel = (limb: Limb) => LIMB_LABEL[limb];

// A branch's badge is the sum of its subtree, so density of conversation is
// visible from across the map without drilling in.
const rollUp = (tree: Tree, id: string): number => {
  const n = tree[id];
  if (!n) return 0;
  if (n.kids.length === 0) return n.count;
  n.count = n.kids.reduce((a, k) => a + rollUp(tree, k), 0);
  return n.count;
};

// ── Placement ──────────────────────────────────────────────────────────────

export const layoutTree = (tree: Tree): Layout => {
  const lay: Layout = {};

  const place = (id: string, cx: number, cy: number, ang: number, depth: number) => {
    const dim = DIM[depth] ?? DIM[4];
    if (!dim) return;
    lay[id] = { cx, cy, w: dim.w, h: dim.h, disc: dim.d, depth, ang };

    const kids = tree[id]?.kids ?? [];
    if (kids.length === 0) return;

    const n = kids.length;
    // Fan width and sibling spacing tighten with depth — a limb sweeps wide off
    // the core, a page cluster stays angularly compact — but the minimum radius
    // stays generous so each level lands in a *distinct outer ring* rather than
    // hugging its parent. Korner pages used to sit only ~160 out from their
    // korner and, once fanned, read as the same level as the korners themselves;
    // pushing depth 2/3 out layers the branch so the hierarchy is legible.
    const span = depth === 1 ? 126 : depth === 2 ? 98 : 76;
    const spacing = depth === 1 ? 132 : depth === 2 ? 116 : 104;
    const base = depth === 1 ? 225 : depth === 2 ? 210 : 170;

    // Dense fans stack into concentric rings rather than sprawling. Radius is
    // arc-length driven — seating n siblings `spacing` apart along an arc of
    // `span` needs radius n*spacing/span — so a korner with many pages
    // physically occupies more of the world than one with few.
    const rings = n > 9 ? 3 : n > 4 ? 2 : 1;
    const need = (n * spacing) / (rad(span) || 1);
    const ringFactor = rings === 3 ? 0.36 : rings === 2 ? 0.5 : 0.72;
    const r = Math.max(base, need * ringFactor);

    kids.forEach((k, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = ang - span / 2 + span * t + (hash(k) - 0.5) * 7;
      const rr = r * (1 + (i % rings) * 0.31) * (0.95 + hash(`${k}r`) * 0.11);
      place(k, cx + Math.cos(rad(a)) * rr, cy + Math.sin(rad(a)) * rr, a, depth + 1);
    });
  };

  const rootDim = DIM[0];
  if (rootDim) {
    lay[ROOT_ID] = {
      cx: 0,
      cy: 0,
      w: rootDim.w,
      h: rootDim.h,
      disc: rootDim.d,
      depth: 0,
      ang: 0,
    };
  }

  for (const limb of LIMBS) {
    const a = LIMB_ANGLE[limb];
    place(limb, Math.cos(rad(a)) * LIMB_RADIUS, Math.sin(rad(a)) * LIMB_RADIUS, a, 1);
  }

  relax(lay);
  return lay;
};

// Separate overlapping nodes along whichever axis they overlap least.
//
// The weighting is the important part: limb roots barely move, korners give a
// little, pages give way completely. That keeps the global silhouette stable —
// Hub stays where you remember it — while unjamming the twigs.
const relax = (lay: Layout, iterations = 220, pad = 22) => {
  const ids = Object.keys(lay).filter((i) => i !== ROOT_ID);
  const give = (id: string) => {
    const d = lay[id]?.depth ?? 3;
    return d === 1 ? 0.12 : d === 2 ? 0.7 : 1;
  };

  for (let it = 0; it < iterations; it++) {
    let hits = 0;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        if (!idA || !idB) continue;
        const a = lay[idA];
        const b = lay[idB];
        if (!a || !b) continue;

        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const ox = (a.w + b.w) / 2 + pad - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + pad - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;

        hits++;
        const ga = give(idA);
        const gb = give(idB);
        const tot = ga + gb || 1;

        if (ox < oy) {
          const s = (dx < 0 ? -1 : 1) * ox * 0.5;
          a.cx -= s * (ga / tot) * 2;
          b.cx += s * (gb / tot) * 2;
        } else {
          const s = (dy < 0 ? -1 : 1) * oy * 0.5;
          a.cy -= s * (ga / tot) * 2;
          b.cy += s * (gb / tot) * 2;
        }
      }
    }

    if (hits === 0) break;
  }
};

export const worldBounds = (lay: Layout): World => {
  let x1 = 1e9;
  let y1 = 1e9;
  let x2 = -1e9;
  let y2 = -1e9;
  for (const p of Object.values(lay)) {
    x1 = Math.min(x1, p.cx - p.w);
    x2 = Math.max(x2, p.cx + p.w);
    y1 = Math.min(y1, p.cy - p.h);
    y2 = Math.max(y2, p.cy + p.h);
  }
  return { x1: x1 - 260, y1: y1 - 260, x2: x2 + 260, y2: y2 + 260 };
};

// ── Emphasis ───────────────────────────────────────────────────────────────

// Breadth-first over the *undirected* tree, so a cousin two hops away reads
// differently from one four hops away. Emphasis is graph distance from the
// focus, not depth in the tree.
export const distances = (tree: Tree, focus: string): Record<string, number> => {
  const dist: Record<string, number> = { [focus]: 0 };
  const queue: [string, number][] = [[focus, 0]];

  while (queue.length) {
    const head = queue.shift();
    if (!head) break;
    const [id, d] = head;
    const node = tree[id];
    if (!node) continue;
    const adjacent = [...node.kids, ...(node.parent ? [node.parent] : [])];
    for (const k of adjacent) {
      if (dist[k] === undefined) {
        dist[k] = d + 1;
        queue.push([k, d + 1]);
      }
    }
  }

  return dist;
};

export const pathTo = (tree: Tree, id: string): string[] => {
  const out: string[] = [];
  let node = tree[id];
  while (node) {
    out.unshift(node.id);
    node = node.parent ? tree[node.parent] : undefined;
  }
  return out;
};

// ── Bones ──────────────────────────────────────────────────────────────────

interface Pt {
  x: number;
  y: number;
}

const cubicPts = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, n: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    });
  }
  return out;
};

// A bone is not a stroke. It is a centreline sampled and offset perpendicular
// by a tapering half-width, emitted as one closed filled ribbon — thick where
// it leaves the parent, thin where it meets the child.
const ribbon = (pts: Pt[], w1: number, w2: number): string => {
  const left: Pt[] = [];
  const right: Pt[] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    const t = i / (pts.length - 1);
    const w = (w1 + (w2 - w1) * t) / 2;
    const a = pts[Math.max(0, i - 1)] ?? p;
    const b = pts[Math.min(pts.length - 1, i + 1)] ?? p;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    left.push({ x: p.x - dy * w, y: p.y + dx * w });
    right.push({ x: p.x + dy * w, y: p.y - dx * w });
  }

  const first = left[0];
  if (!first) return '';
  const d = [`M${first.x.toFixed(1)},${first.y.toFixed(1)}`];
  for (let i = 1; i < left.length; i++) {
    const q = left[i];
    if (q) d.push(`L${q.x.toFixed(1)},${q.y.toFixed(1)}`);
  }
  for (let i = right.length - 1; i >= 0; i--) {
    const q = right[i];
    if (q) d.push(`L${q.x.toFixed(1)},${q.y.toFixed(1)}`);
  }
  return `${d.join(' ')} Z`;
};

export interface Bone {
  id: string;
  parent: string;
  d: string;
  jointX: number;
  jointY: number;
  jointR: number;
}

// Bone thickness by the child's depth, so structural rank is readable without
// labels: limbs are the heaviest members, page bones the finest.
const BONE_W: Record<number, [number, number]> = {
  1: [15, 8],
  2: [10, 5],
  3: [7, 3.5],
  4: [5.5, 3],
};

export const buildBones = (tree: Tree, lay: Layout): Bone[] => {
  const bones: Bone[] = [];

  const walk = (id: string) => {
    const parent = lay[id];
    const node = tree[id];
    if (!parent || !node) return;

    for (const k of node.kids) {
      const child = lay[k];
      if (!child) continue;

      const dx = child.cx - parent.cx;
      const dy = child.cy - parent.cy;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Trim to the disc rims so the bone tucks under each disc edge.
      const startR = parent.depth === 0 ? 21 : (parent.disc / 2) * 0.96;
      const endR = (child.disc / 2) * 0.96;
      const p0 = { x: parent.cx + ux * startR, y: parent.cy + uy * startR };
      const p1 = { x: child.cx - ux * endR, y: child.cy - uy * endR };

      // Control points follow the branch headings, not the straight line
      // between the discs — which is precisely why bones curve: the bend
      // reconciles the parent's heading with the child's.
      const pa = rad(parent.ang);
      const ca = rad(child.ang);
      const c1 = { x: p0.x + Math.cos(pa) * dist * 0.34, y: p0.y + Math.sin(pa) * dist * 0.34 };
      const c2 = { x: p1.x - Math.cos(ca) * dist * 0.28, y: p1.y - Math.sin(ca) * dist * 0.28 };

      const w = BONE_W[child.depth] ?? BONE_W[4] ?? [5.5, 3];
      bones.push({
        id: k,
        parent: id,
        d: ribbon(cubicPts(p0, c1, c2, p1, 22), w[0], w[1]),
        jointX: p0.x,
        jointY: p0.y,
        jointR: w[0] * 0.42,
      });

      walk(k);
    }
  };

  walk(ROOT_ID);
  return bones;
};

// ── Wires ──────────────────────────────────────────────────────────────────
//
// Bones are anatomy: where a page sits in the platform. Wires are the other
// thing the registry knows — that composing here creates a card there, that
// this surface listens to that korner's events. They cross the tree rather
// than following it, which is exactly why they cannot be drawn like bones: a
// filled tapered ribbon reads as structure, and these are not structure.
// Thin, dashed, bowed away from the trunk, and — crucially — hidden unless
// they touch where you are standing. All 26 drawn at once is a hairball that
// says nothing; the handful attached to your current node is a sentence.

export interface Wire {
  id: string;
  from: string;
  to: string;
  kind: string;
  description: string;
  d: string;
  labelX: number;
  labelY: number;
}

export const buildWires = (
  tree: Tree,
  lay: Layout,
  nodes: KommonsNode[],
): Wire[] => {
  const wires: Wire[] = [];
  const seen = new Set<string>();

  for (const n of nodes) {
    for (const link of n.links ?? []) {
      const a = lay[n.id];
      const b = lay[link.to];
      // A link may name a node that is not on the map — a korner-level target,
      // or a page that has not been registered yet. Skipped rather than
      // guessed at.
      if (!a || !b || !tree[n.id] || !tree[link.to]) continue;

      // One wire per pair. Links are declared from both ends often enough
      // that drawing each direction would double every line.
      const key = [n.id, link.to].sort().join('~');
      if (seen.has(key)) continue;
      seen.add(key);

      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      const p0 = { x: a.cx + ux * (a.disc / 2) * 0.98, y: a.cy + uy * (a.disc / 2) * 0.98 };
      const p1 = { x: b.cx - ux * (b.disc / 2) * 0.98, y: b.cy - uy * (b.disc / 2) * 0.98 };

      // Bow perpendicular, away from the core, so a wire arcs clear of the
      // trunk it crosses instead of lying on top of it.
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      const outward = Math.hypot(mx, my) || 1;
      const bow = Math.min(dist * 0.22, 150);
      const cx = mx + (mx / outward) * bow;
      const cy = my + (my / outward) * bow;

      wires.push({
        id: `${n.id}~${link.to}`,
        from: n.id,
        to: link.to,
        kind: link.kind,
        description: link.description,
        d: `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
        // Quadratic midpoint, not the chord midpoint — the label has to sit
        // on the curve or it floats off in empty space beside it.
        labelX: 0.25 * p0.x + 0.5 * cx + 0.25 * p1.x,
        labelY: 0.25 * p0.y + 0.5 * cy + 0.25 * p1.y,
      });
    }
  }

  return wires;
};

// ── Camera ─────────────────────────────────────────────────────────────────

export interface Camera {
  x: number;
  y: number;
  s: number;
}

// Frame the focus and its children. The scale floor is deliberate: better to
// let a big fan spill off the edge — the drag will reach it — than shrink
// every icon to illegibility so one crowded limb fits.
export const cameraFor = (
  tree: Tree,
  lay: Layout,
  focus: string,
  viewW: number,
  viewH: number,
): Camera => {
  const node = tree[focus];
  const ids = [focus, ...(node?.kids ?? [])].filter((i) => lay[i]);

  let x1 = 1e9;
  let y1 = 1e9;
  let x2 = -1e9;
  let y2 = -1e9;
  for (const i of ids) {
    const p = lay[i];
    if (!p) continue;
    x1 = Math.min(x1, p.cx - p.w / 2);
    x2 = Math.max(x2, p.cx + p.w / 2);
    y1 = Math.min(y1, p.cy - p.h / 2);
    y2 = Math.max(y2, p.cy + p.h / 2);
  }

  const bw = Math.max(x2 - x1, 200);
  const bh = Math.max(y2 - y1, 200);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const pad = 150;
  const fit = Math.min((viewW - pad) / bw, (viewH - pad) / bh, 1.25);
  const s = Math.max(0.78, Math.min(fit, 1.25));

  return { x: viewW / 2 - cx * s, y: viewH / 2 - cy * s, s };
};
