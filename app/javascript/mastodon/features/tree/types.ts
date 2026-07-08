// See docs/tree-brief.md for the full model.
//
// Two node kinds:
//   - Sub-layer = a place. Curated skeleton, ~3 per branch.
//   - Idea     = a thing to build. Unlimited leaf inside a place.

export type TopLayer = 'digital' | 'community' | 'platform';

export type Readiness =
  | 'blocked'
  | 'provisional'
  | 'ready'
  | 'building'
  | 'done';

export type Priority = 'low' | 'medium' | 'high';

export type DepKind = 'needs' | 'secures' | 'relates';

export interface SubLayer {
  id: string;
  name: string;
  ideas: Idea[];
  children?: SubLayer[];
}

export interface Idea {
  id: string;
  name: string;
  description?: string;
  status: Readiness;
  priority: Priority;
}

export interface TopBranch {
  key: TopLayer;
  name: string;
  tagline: string;
  color: string;
  sublayers: SubLayer[];
}
