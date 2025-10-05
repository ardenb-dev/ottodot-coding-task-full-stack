import * as z from "zod";

export const MathProblemSubmitRequestSchema = z.object({
  session_id: z.uuid(),
  answer: z.number(),
});
