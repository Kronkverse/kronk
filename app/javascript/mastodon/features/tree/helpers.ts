import type { TreeNode, TreeDependency, DepKind } from './types';

// Direct children of a node (parent_id === parentId), stable-sorted by
// position and then id so the tree renders deterministically across
// re-fetches.
export function childrenOf(
  nodes: TreeNode[],
  parentId: string | null,
): TreeNode[] {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function findNode(
  nodes: TreeNode[],
  id: string | null | undefined,
): TreeNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) ?? null;
}

export function pathTo(
  nodes: TreeNode[],
  id: string | null,
): TreeNode[] {
  const path: TreeNode[] = [];
  let current = findNode(nodes, id);
  while (current) {
    path.unshift(current);
    current = findNode(nodes, current.parent_id);
  }
  return path;
}

// Count of idea descendants under a node (excluding the node itself).
export function ideaDescendantCount(
  nodes: TreeNode[],
  id: string,
): number {
  let count = 0;
  const walk = (parentId: string) => {
    for (const child of childrenOf(nodes, parentId)) {
      if (child.kind === 'idea') count += 1;
      walk(child.id);
    }
  };
  walk(id);
  return count;
}

export function depsFrom(
  deps: TreeDependency[],
  nodeId: string,
  kind?: DepKind,
): TreeDependency[] {
  return deps.filter(
    (d) => d.from_node_id === nodeId && (kind === undefined || d.kind === kind),
  );
}

export function depsTo(
  deps: TreeDependency[],
  nodeId: string,
  kind?: DepKind,
): TreeDependency[] {
  return deps.filter(
    (d) => d.to_node_id === nodeId && (kind === undefined || d.kind === kind),
  );
}

// Top-branch colours for the seeded structure. These match the
// prototype's layer-colour system (see public/tree.html).
export const BRANCH_COLORS: Record<string, string> = {
  Digital: '#563acc',
  Community: '#3fb984',
  Platform: '#e8b04b',
};

export function branchColorFor(nodes: TreeNode[], node: TreeNode): string {
  const path = pathTo(nodes, node.id);
  // Skip root ("Kronk"), take next-level ancestor
  const top = path[1];
  if (!top) return BRANCH_COLORS.Digital ?? '#563acc';
  return BRANCH_COLORS[top.name] ?? '#8a8a99';
}
