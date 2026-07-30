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
  current_vote: {
    position: string;
    title: string | null;
    statement: string | null;
  } | null;
  vote_summary: { agree: number; abstain: number; block: number };
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
  voters: {
    id: string;
    position: 'agree' | 'abstain' | 'block';
    title: string | null;
    statement: string | null;
    created_at: string;
    account: {
      id: string;
      username: string;
      display_name: string;
      avatar: string;
    };
  }[];
  challenges: {
    id: string;
    title: string | null;
    statement: string | null;
    account: {
      id: string;
      username: string;
      display_name: string;
      avatar: string;
    };
    conditions: {
      id: string;
      text: string;
      met: boolean;
      met_at: string | null;
      responses: {
        id: string;
        body: string;
        created_at: string;
        account: {
          id: string;
          username: string;
          display_name: string;
          avatar: string;
        };
      }[];
    }[];
  }[];
}

// Moved here from the deleted proposal_tabs/tab_kontribute component (which was
// dead apart from these types). Kontribute tasks + budget items.
export interface Task {
  id: string;
  proposal_id: string;
  title: string;
  description: string | null;
  status: string;
  skill_tag: string | null;
  effort_estimate: number | null;
  created_at: string;
  assigned_to_account?: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
}

export interface BudgetItem {
  id: string;
  proposal_id: string;
  description: string;
  cost_estimate: number;
  currency: string;
  status: string;
}
