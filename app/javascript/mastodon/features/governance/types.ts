export interface Proposal {
  id: string;
  title: string;
  body: string;
  status: 'open' | 'delivered' | 'completed' | 'annulled';
  proposal_type: 'small' | 'medium' | 'large';
  categories: string[];
  discussion_status_id: string | null;
  opens_at: string | null;
  outcome_notes: string | null;
  archived_at: string | null;
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
