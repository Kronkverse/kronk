export interface Answerer {
  id: string;
  username: string;
  acct: string;
  avatar: string;
}

export interface Question {
  id: string;
  content: string;
  created_at: string;
  answers_count: number;
  has_answered: boolean;
  answerers: Answerer[];
  account: {
    id: string;
    username: string;
    display_name: string;
    acct: string;
    avatar: string;
  };
}

export interface Answer {
  id: string;
  content: string;
  created_at: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    acct: string;
    avatar: string;
  };
}
