import * as z from "zod";

export const MathProblemSubmitRequestSchema = z.object({
  session_id: z.uuid(),
  answer: z.number(),
});

export const MathProblemSubmitResponseSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

export type MathProblemSubmitResponseType = z.infer<
  typeof MathProblemSubmitResponseSchema
>;
