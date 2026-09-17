// Lattice open/fold state (spec §8).
//
// `open` is the set of expanded node ids. Two rules make the view what it is:
// only one branch is open per level, and folding prunes recursively — closing
// Hub must also drop Booth and Booth's pages, or orphans in the set make
// branches reappear unexpectedly later.

import type { Tree } from '../../kommons_tree/data/layout';

// Remove `id` and its whole subtree from the open set.
const prune = (
  open: ReadonlySet<string>,
  tree: Tree,
  id: string,
): Set<string> => {
  const next = new Set(open);
  const stack = [id];
  while (stack.length > 0) {
    const n = stack.pop();
    if (n === undefined) break;
    next.delete(n);
    for (const k of tree[n]?.kids ?? []) stack.push(k);
  }
  return next;
};

// The set of expanded nodes after clicking `id`.
//
// - the core folds everything back to the limbs
// - an open node folds (it and its subtree leave the set)
// - a closed node opens, folding any open sibling at its level first
export const toggleBranch = (
  open: ReadonlySet<string>,
  tree: Tree,
  id: string,
  rootId: string,
): Set<string> => {
  if (id === rootId) return new Set([rootId]);
  if (open.has(id)) return prune(open, tree, id);

  const parentId = tree[id]?.parent ?? rootId;
  const siblings = tree[parentId]?.kids ?? [];
  let next = new Set<string>(open);
  for (const sib of siblings) {
    if (sib !== id) next = prune(next, tree, sib);
  }
  next.add(id);
  return next;
};

// The active path: the single open branch, root downward. At most one child per
// level is open, so this is an unambiguous chain — used to light the wires and
// rows along the way.
export const activePath = (
  open: ReadonlySet<string>,
  tree: Tree,
  rootId: string,
): Set<string> => {
  const path = new Set<string>([rootId]);
  let current = rootId;
  for (;;) {
    const nextChild = (tree[current]?.kids ?? []).find((k) => open.has(k));
    if (nextChild === undefined) break;
    path.add(nextChild);
    current = nextChild;
  }
  return path;
};
