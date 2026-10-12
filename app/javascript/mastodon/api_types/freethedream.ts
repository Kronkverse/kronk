// FreeTheDream's API shapes (Freethedream::View on the server).

export type FtdCategory =
  | 'skills'
  | 'things'
  | 'space'
  | 'time'
  | 'money'
  | 'connections';

export type FtdItemKind = 'idea' | 'need' | 'job' | 'offer';
export type FtdJoining = 'open' | 'by_request';
export type FtdMembership = 'none' | 'member' | 'requested';

export interface FtdAccount {
  id: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export interface FtdRef {
  id: string;
  title: string;
}

export interface FtdPartOption extends FtdRef {
  depth: number;
}

export interface FtdProjectSummary {
  id: string;
  title: string;
  description: string;
  owner: FtdAccount | null;
  ends_on: string | null;
  done: boolean;
  joining: FtdJoining;
  members_count: number;
  parts_count: number;
  needs_count: number;
  needs_met: number;
  membership: FtdMembership;
}

export interface FtdPartRow {
  id: string;
  title: string;
  owner: FtdAccount | null;
  done: boolean;
  parts_count: number;
  items_count: number;
}

export interface FtdItemRow {
  id: string;
  kind: FtdItemKind;
  title: string;
  category: FtdCategory | null;
  quantity: number;
  owner: FtdAccount | null;
  mine: boolean;
  covered?: number;
  spare?: number;
  claimed?: number;
  claimed_by_me?: boolean;
  need?: FtdRef | null;
  taken_on?: { type: 'part' | 'job'; id: string; title: string } | null;
}

export interface FtdComment {
  id: string;
  account: FtdAccount | null;
  body: string;
  created_at: string;
  mine: boolean;
}

export interface FtdProject {
  id: string;
  title: string;
  description: string;
  owner: FtdAccount | null;
  top: boolean;
  root: FtdRef;
  ancestors: FtdRef[];
  ends_on: string | null;
  done: boolean;
  joining: FtdJoining;
  up_for_grabs: boolean;
  source_idea: FtdRef | null;
  parts: FtdPartRow[];
  items: FtdItemRow[];
  depends_on: FtdRef[];
  needed_by: FtdRef[];
  membership: FtdMembership;
  members_count: number;
  members: FtdAccount[];
  requests: FtdAccount[];
  all_parts: FtdPartOption[];
  comments: FtdComment[];
  can: {
    add: boolean;
    edit: boolean;
    remove: boolean;
    take_over: boolean;
    hand_over: boolean;
    comment: boolean;
  };
}

export interface FtdItem extends FtdItemRow {
  body: string;
  root: FtdRef;
  up_for_grabs: boolean;
  placements: FtdRef[];
  offers: FtdItemRow[];
  claims: FtdAccount[];
  source_idea: FtdRef | null;
  all_parts: FtdPartOption[];
  comments: FtdComment[];
  can: {
    edit: boolean;
    remove: boolean;
    take_over: boolean;
    hand_over: boolean;
    comment: boolean;
    offer: boolean;
    claim: boolean;
    take_on: boolean;
    place: boolean;
    unplace: boolean;
  };
}

export interface FtdAsset {
  id: string;
  category: FtdCategory;
  title: string;
  note: string;
  quantity: number;
  shared_with: FtdRef[];
}

export interface FtdAudit {
  root: FtdRef;
  categories: {
    category: FtdCategory | null;
    needs: {
      id: string;
      title: string;
      quantity: number;
      covered: number;
      parts: string[];
    }[];
    shared: {
      id: string;
      title: string;
      note: string;
      quantity: number;
      account: FtdAccount | null;
    }[];
  }[];
}
