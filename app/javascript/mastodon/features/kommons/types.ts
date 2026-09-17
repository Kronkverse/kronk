export interface Proposal {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  node_id: string | null;
  status: 'open' | 'delivered' | 'completed' | 'annulled';
  proposal_type: 'small' | 'medium' | 'large';
  categories: string[];
  discussion_status_id: string | null;
  opens_at: string | null;
  outcome_notes: string | null;
  support_count: number;
  challenge_count: number;
  participation_count: number;
  created_at: string;
  task_summary: { open: number; in_progress: number; done: number };
  budget_total: number;
  backing: {
    total: number;
    backers: number;
    rank: number | null;
    my_stake: number;
    my_balance: number | null;
    open: boolean;
  };
  created_by_account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
}

// `current_vote`, `vote_summary`, `voters`, `challenges` retired 2026-09-05
// alongside the ProposalSerializer slim — token backing is the sole support
// signal now, no vote UI consumes the vote-model payload.

// `Task` + `BudgetItem` were the payloads for the deleted task_card.tsx /
// budget_item_row.tsx / new_task_form.tsx components — retired 2026-09-05.
// proposal_steps.tsx carries its own local `Task` interface for its narrower
// needs.
