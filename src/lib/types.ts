export interface Session {
  id: string;
  title: string;
  current_sentence: string;
  current_iteration: number;
  status: "waiting" | "voting" | "completed";
  created_at: string;
}

export interface Vote {
  id: string;
  session_id: string;
  iteration: number;
  word: string;
  created_at: string;
}

export interface WordCount {
  word: string;
  count: number;
}
