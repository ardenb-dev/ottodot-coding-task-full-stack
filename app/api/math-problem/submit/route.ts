/**
 * 
 * 
 * POST /api/math-problem/submit (Submit Answer)
    Receive the session ID and user's answer
    Check if the answer is correct
    Use AI to generate personalized feedback based on:
        The original problem
        The correct answer
        The user's answer
        Whether they got it right or wrong
    Save the submission to math_problem_submissions table
    Return the feedback and correctness to the frontend
 */

import * as z from "zod";
import { InsertType, supabase } from "../../../../lib/supabaseClient";
import { executePrompt } from "../../../../lib/geminiClient";
import { GenerateContentConfig } from "@google/genai";

const FeedbackMathProblemConfig: GenerateContentConfig = {
  responseMimeType: "application/json",
  systemInstruction: `
  You are an encouraging, world-class math tutor for Primary 5 students. Your sole task is to is to provide highly focused, supportive, and instructional feedback.

  Follow these strict rules for your response:
    1. **Tone:** Always maintain a positive, non-judgmental, and encouraging tone.
    2. **If CORRECT:** Offer enthusiastic praise and reinforce the underlying mathematical concept (e.g., "Great use of the power rule!").
    3. **If INCORRECT (Most Important):**
        - **Diagnose the Error:** Identify the most likely specific mistake (e.g., sign error, forgotten chain rule, calculation mistake).
        - **Provide Next Steps:** Clearly explain the correct approach and the final solution **step-by-step.**
    `,
};

const MathProblemSubmitRequestSchema = z.object({
  session_id: z.uuid(),
  answer: z.number(),
});

const MathProblemSubmitResponseSchema = z.object({
  isCorrect: z.boolean(),
  feedback: z.string(),
});

type MathProblemSubmitResponseType = z.infer<
  typeof MathProblemSubmitResponseSchema
>;

export async function POST(request: Request) {
  const rawBody = await request.json();
  const requestBody = MathProblemSubmitRequestSchema.parse(rawBody);

  // 1. Via sessionId get the problem info from the database
  const { data } = await supabase
    .from("math_problem_sessions")
    .select(`problem_text, correct_answer`)
    .eq("id", requestBody.session_id);

  console.log("SUPABASE", data);

  const problemText = data[0]["problem_text"];
  const correctAnswer = data[0]["correct_answer"];

  const isCorrect = correctAnswer === requestBody.answer;

  const userQuery = `
    Generate personalized tutoring feedback based on the session data below:

    **Problem:** ${problemText}
    **Correct Answer:** ${correctAnswer}
    **User's Attempt:** ${requestBody.answer}
    **Outcome Status:** ${isCorrect ? "CORRECT" : "INCORRECT"}
  `;

  console.log("USER QUERY", userQuery);

  const feedbackPrompt = await executePrompt({
    contents: [{ parts: [{ text: userQuery }] }],
    config: FeedbackMathProblemConfig,
  });

  const feedbackResponse = JSON.parse(
    feedbackPrompt.candidates[0].content.parts[0].text
  )["feedback"];

  const dataToInsert: InsertType<"math_problem_submissions"> = {
    session_id: requestBody.session_id,
    user_answer: requestBody.answer,
    is_correct: isCorrect,
    feedback_text: feedbackResponse,
  };

  await supabase.from("math_problem_submissions").insert([dataToInsert]);

  const resultSet: MathProblemSubmitResponseType = {
    isCorrect: isCorrect,
    feedback: feedbackResponse,
  };

  return new Response(JSON.stringify(resultSet), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
