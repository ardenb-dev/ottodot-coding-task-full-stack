import * as z from "zod";

export const MathProblemRequestSchema = z.object({
  difficulty_level: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
});

export const MathProblemResponseSchema = z.object({
  problem_text: z.string(),
  correct_answer: z.number(),
  session_id: z.uuid(),
});
