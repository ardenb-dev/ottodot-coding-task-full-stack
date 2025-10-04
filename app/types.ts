export type DIFFICULTY_LEVEL = "EASY" | "MEDIUM" | "HARD";

export interface MathProblem {
  problem_text: string;
  correct_answer: number;
}

export interface MathProblemAPIRequestType {
  difficulty_level: DIFFICULTY_LEVEL;
}

export interface MathProblemAPIResponseType {
  problem_text: string;
  correct_answer: number;
  session_id: string;
}

export interface FeedbackAnswerAPIRequestType {
  session_id: string;
  answer: number;
}

export interface FeedbackAnserAPIResponseType {
  isCorrect: boolean;
  feedback: string;
}
