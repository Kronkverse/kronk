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

// Needs met and jobs filled, out of all of them, here and below.
export interface FtdProgress {
  sorted: number;
  total: number;
  open_jobs: number;
}

export interface FtdCover {
  id: string;
  url: string;
  preview_url: string;
}

// The Kalendar event an in-person project happens at (a korner attachment
// from the event). `location_url` is the OpenStreetMap link Kalendar's pin
// picker writes.
export interface FtdEvent {
  id: string;
  slug: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location_name: string | null;
  location_url: string | null;
  image_url: string | null;
  going_count: number;
  interested_count: number;
  rsvp_enabled: boolean;
  my_rsvp: 'going' | 'interested' | 'not_going' | null;
  attachment_id: string;
  can_unlink: boolean;
}

export interface FtdProjectSummary {
  id: string;
  title: string;
  description: string;
  owner: FtdAccount | null;
  cover: FtdCover | null;
  ends_on: string | null;
  done: boolean;
  joining: FtdJoining;
  members_count: number;
  progress: FtdProgress;
  membership: FtdMembership;
}

export interface FtdSectionRow {
  id: string;
  title: string;
  owner: FtdAccount | null;
  done: boolean;
  sections_count: number;
  progress: FtdProgress;
}

export interface FtdContribution {
  account: FtdAccount | null;
  quantity: number;
  offer_id: string;
}

export interface FtdItemRow {
  id: string;
  kind: FtdItemKind;
  title: string;
  category: FtdCategory | null;
  quantity: number;
  unit: string;
  owner: FtdAccount | null;
  mine: boolean;
  covered?: number;
  left?: number;
  spare?: number;
  contributors?: FtdContribution[];
  my_quantity?: number;
  claimed?: number;
  claimers?: (FtdAccount | null)[];
  claimed_by_me?: boolean;
  need?: FtdRef | null;
  taken_on?: { type: 'part' | 'job'; id: string; title: string } | null;
}

export interface FtdComment {
  id: string;
  account: FtdAccount | null;
  body: string;
  removed: boolean;
  created_at: string;
  mine: boolean;
  resolved: boolean;
  resolved_by: FtdAccount | null;
  replies: FtdComment[];
}

export type FtdUpdateVerb =
  | 'section_added'
  | 'need_added'
  | 'job_added'
  | 'idea_added'
  | 'offer_added'
  | 'bringing'
  | 'claimed'
  | 'taken_on'
  | 'done';

export interface FtdUpdate {
  id: string;
  verb: FtdUpdateVerb;
  account: FtdAccount | null;
  project: FtdRef;
  item_id: string | null;
  data: {
    title?: string;
    quantity?: number;
    unit?: string;
    section_id?: string;
  };
  created_at: string;
}

export type FtdStillNeeded = FtdItemRow & { section: FtdRef | null };

export interface FtdProject {
  id: string;
  title: string;
  description: string;
  owner: FtdAccount | null;
  top: boolean;
  root: FtdRef;
  ancestors: FtdRef[];
  cover: FtdCover | null;
  event: FtdEvent | null;
  ends_on: string | null;
  done: boolean;
  joining: FtdJoining;
  up_for_grabs: boolean;
  source_idea: FtdRef | null;
  progress: FtdProgress;
  sections: FtdSectionRow[];
  still_needed: FtdStillNeeded[];
  items: FtdItemRow[];
  depends_on: FtdRef[];
  needed_by: FtdRef[];
  updates: FtdUpdate[];
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
    invite: boolean;
    link_event: boolean;
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
      unit: string;
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
