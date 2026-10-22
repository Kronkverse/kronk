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
  // What its card shows: its own cover (small), else the image of the
  // Kalendar event it's linked to, if you can see that event.
  image_url: string | null;
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
  people_count: number;
  progress: FtdProgress;
}

// A person in a project, on its Overview, with what they're on.
export interface FtdCrewRow {
  account: FtdAccount;
  bringing: FtdRef[];
  actualising: FtdRef[];
}

export interface FtdPersonRow {
  account: FtdAccount | null;
  organiser: boolean;
  leads: FtdRef[];
  jobs: number;
  bringing: number;
  last_active: string;
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
  // A need: whether more than its amount is welcome (20+ plates, but 2
  // gas bottles).
  more_welcome?: boolean;
  covered?: number;
  left?: number;
  spare?: number;
  contributors?: FtdContribution[];
  my_quantity?: number;
  claimed?: number;
  claimers?: (FtdAccount | null)[];
  claimed_by_me?: boolean;
  need?: FtdRef | null;
  // An offer: shared from its owner's Mycelium.
  mycelium?: boolean;
}

// A thing on the list, quoted on a comment about it.
export interface FtdQuotedItem {
  id: string;
  kind: FtdItemKind;
  title: string;
  quantity: number;
  unit: string;
  covered?: number;
  more_welcome?: boolean;
}

export interface FtdComment {
  id: string;
  account: FtdAccount | null;
  body: string;
  quoted_item: FtdQuotedItem | null;
  // The people tagged in it, by the @username written in the body.
  mentions: (FtdAccount & { username: string })[];
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

// What's the viewer's in a project, for its dashboard. `unseen` lists the
// project and sections with talk they haven't looked at.
export interface FtdMine {
  groups: (FtdSectionRow & { unseen: number })[];
  unseen: (FtdRef & { count: number })[];
  jobs: (FtdRef & { section: FtdRef | null })[];
  bringing: (FtdRef & {
    quantity: number;
    unit: string;
    // How many the need asks for.
    about: number;
    more_welcome: boolean;
    section: FtdRef | null;
  })[];
  needed: FtdStillNeeded[];
  needed_count: number;
}

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
  // Gear needed in the sections inside, section by section.
  inside: { section: FtdRef; items: FtdItemRow[] }[];
  depends_on: FtdRef[];
  needed_by: FtdRef[];
  updates: FtdUpdate[];
  membership: FtdMembership;
  members_count: number;
  members: FtdAccount[];
  people: FtdPersonRow[];
  // The Krew made with the emergence: everyone in it is in the Krew.
  krew: { id: string; slug: string; name: string } | null;
  // emergence → gang → fractal (Kitchen → Cooking); nothing goes deeper.
  level: 'emergence' | 'gang' | 'fractal';
  // A gang's or fractal's people and what each is on there.
  crew: FtdCrewRow[];
  // Gear gathered (anyone bringing it) of gear listed, everything inside.
  gear: { gathered: number; total: number };
  mine: FtdMine | null;
  requests: FtdAccount[];
  all_parts: FtdPartOption[];
  comments: FtdComment[];
  // For its owner: someone else has something in it, so it can't be
  // removed yet (false for everyone else).
  others_inside: boolean;
  can: {
    add: boolean;
    edit: boolean;
    remove: boolean;
    take_over: boolean;
    hand_over: boolean;
    comment: boolean;
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
    place: boolean;
    unplace: boolean;
  };
}

// Something in your Mycelium (docs/spaces/freethedream.md, Mycelium):
// private to you. Where you've offered it on its own (On offer), and what
// you're bringing it against.
export interface FtdMyceliumItem {
  id: string;
  category: FtdCategory;
  title: string;
  note: string;
  quantity: number;
  offered_in: { offer_id: string; project: FtdRef; quantity: number }[];
  bringing: {
    offer_id: string;
    need: FtdRef;
    project: FtdRef;
    quantity: number;
  }[];
}
