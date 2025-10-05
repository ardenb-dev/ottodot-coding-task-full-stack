import { InsertType, supabase } from "../../../../lib/supabaseClient";
import { executeStreamPrompt } from "../../../../lib/geminiClient";
import { GenerateContentConfig } from "@google/genai";
import { MathProblemSubmitRequestSchema } from "./schema";

const FeedbackMathProblemConfig: GenerateContentConfig = {
  temperature: 0.1,
  systemInstruction: `
  You are an encouraging, world-class math tutor for Primary 5 students. Your sole task is to is to provide highly focused, supportive, and instructional feedback.

  Follow these strict rules for your response:
    1. **Tone:** Always maintain a positive, non-judgmental, and encouraging tone.
    2. **If CORRECT:** Offer enthusiastic praise and reinforce the underlying mathematical concept (e.g., "Great use of the power rule!"). Also show a step-by-step solution to clarify the best approach to the problem.
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

  const feedbackPrompt = await executeStreamPrompt({
    contents: [{ parts: [{ text: userQuery }] }],
    config: FeedbackMathProblemConfig,
  });

  let fullFeedback = "";

  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of feedbackPrompt) {
          const text = chunk.candidates[0].content.parts[0].text;
          fullFeedback += text;
          controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();

        const dataToInsert: InsertType<"math_problem_submissions"> = {
          session_id: requestBody.session_id,
          user_answer: requestBody.answer,
          is_correct: isCorrect,
          feedback_text: fullFeedback,
        };

        await supabase
          .from("math_problem_submissions")
          .insert([dataToInsert] as never);
      }
    },
  });

  return new Response(readableStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
