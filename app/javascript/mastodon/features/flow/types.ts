export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface FlowCycle {
  id: string;
  started_on: string;
  ended_on: string | null;
  cycle_length: number | null;
  notes: string | null;
  current_phase: CyclePhase;
  ovulation_day: string;
  fertile_window_start: string;
  fertile_window_end: string;
  predicted_next_start: string;
  shared_with_account_ids: string[];
  is_owner: boolean;
  created_at: string;
}
