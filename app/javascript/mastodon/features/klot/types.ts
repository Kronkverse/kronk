export type PhaseKey = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface KlotPeriod {
  id: string;
  started_on: string; // ISO date, no time
  created_at: string;
}

export interface KlotSettings {
  cycle_length: number;
  period_length: number;
  updated_at: string;
}

export interface KlotShareAccount {
  id: string;
  acct: string;
  username: string;
  display_name: string;
  avatar: string;
}

export interface KlotShare {
  id: string;
  viewer_account: KlotShareAccount;
  created_at: string;
}

export interface KlotPhase {
  account_id: string;
  phase: PhaseKey;
  as_of: string;
}
