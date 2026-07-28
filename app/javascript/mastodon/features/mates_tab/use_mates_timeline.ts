import timelineData from './data/timeline_synthesised.json';

export interface TimelineMember {
  id: string;
  rank: number;
  handle: string;
  display_name: string;
  joined_at: string; // ISO date (day-precision; time-of-day is ignored)
  inviter_id: string | null;
  connections: number;
  korners: string[];
  vouch_count: number;
}

export interface MateBond {
  member_a: string;
  member_b: string;
  mates_since: string; // ISO date
}

export interface MatesTimelineData {
  generated_at: string;
  provenance: string;
  anchor_date: string;
  members: TimelineMember[];
  mates: MateBond[];
}

// TODO: swap for a live fetch when the Mates timeline endpoint lands
// (Kommons proposal "Mates" #116990859270976043, timeline-brief step).
// Contract per KRONK_KOMMUNITY.md § Data required:
// GET /api/v1/kronk/mates/timeline?subject=<acct> returns the same
// shape (members + mates + inviter_id). Real data still needs the 5
// unresolveds from the brief settled (visibility scope, mate model,
// tombstoned members, date semantics, empty states) before it can
// ship — the bundled version below sidesteps those with defaults.
export const useMatesTimeline = (): MatesTimelineData =>
  timelineData as MatesTimelineData;
