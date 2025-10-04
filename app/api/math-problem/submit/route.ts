import { InsertType, supabase } from "../../../../lib/supabaseClient";
import { executePrompt } from "../../../../lib/geminiClient";
import { GenerateContentConfig } from "@google/genai";
import {
  MathProblemSubmitRequestSchema,
  MathProblemSubmitResponseType,
} from "./schema";

// TODO Do not show final answer on feedback

const FeedbackMathProblemConfig: GenerateContentConfig = {
  responseMimeType: "application/json",
  temperature: 0.1,
  systemInstruction: `
  You are an encouraging, world-class math tutor for Primary 5 students. Your sole task is to is to provide highly focused, supportive, and instructional feedback.

  Follow these strict rules for your response:
    1. **Tone:** Always maintain a positive, non-judgmental, and encouraging tone.
    2. **If CORRECT:** Offer enthusiastic praise and reinforce the underlying mathematical concept (e.g., "Great use of the power rule!").
    3. **If INCORRECT (Most Important):**
        - **Diagnose the Error:** Identify the most likely specific mistake (e.g., sign error, forgotten chain rule, calculation mistake).
        - ****Provide Guidance:** Clearly explain the concept the student missed and guide them on the **first one or two correct steps** they should take to solve the problem, stopping just before the final numerical answer. Do not give the final numerical answer.
    `,
};

export async function POST(request: Request) {
  const rawBody = await request.json();
  const requestBody = MathProblemSubmitRequestSchema.parse(rawBody);

  // 1. Via sessionId get the problem info from the database
  const { data } = await supabase
    .from("math_problem_sessions")
    .select(`problem_text, correct_answer`)
    .eq("id", requestBody.session_id);

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

  await supabase
    .from("math_problem_submissions")
    .insert([dataToInsert] as never);

  const resultSet: MathProblemSubmitResponseType = {
    isCorrect: isCorrect,
    feedback: feedbackResponse,
  };

  return new Response(JSON.stringify(resultSet), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
