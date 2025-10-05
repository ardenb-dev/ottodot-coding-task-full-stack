import { InsertType, supabase } from "../../../../lib/supabaseClient";
import { executeStreamPrompt } from "../../../../lib/geminiClient";
import { GenerateContentConfig } from "@google/genai";
import { MathProblemSubmitRequestSchema } from "./schema";

// 1. Refined System Instruction for clarity and robustness
const FeedbackMathProblemConfig: GenerateContentConfig = {
  temperature: 0.1,
  // Added a specific formatting request (Markdown) and clarified the target age group.
  systemInstruction: `
  You are an encouraging, world-class math tutor for 10 to 11-year-old students (Primary 5 level). Your sole task is to provide highly focused, supportive, and instructional feedback.

  Follow these strict rules for your response:
    1. **Tone:** Always maintain a positive, non-judgemental, and encouraging tone.
    2. **Formatting:** 
        - DO NOT use any LaTeX or MathJax syntax. (No $...$, $$...$$, \\(...\\), \\[...\\], or similar.)
        - Use plain Markdown (headers, bullet lists, inline code) and simple arithmetic notation.
        - For fractions use "20/100" or the phrase "20 out of 100" (you may also include the percent in parentheses).
    3. **If CORRECT:** Offer enthusiastic praise. Reinforce the underlying mathematical concept (e.g., "Great use of the concept of common denominators!"). Show a clear, step-by-step solution using bullet points to clarify the best approach.
    4. **If INCORRECT (Most Important):**
        - **Diagnose the Error:** Identify the most likely specific mistake (e.g., a simple calculation error, confusion between multiplication and division, or mixing up fractions).
        - **Provide Guidance:** Clearly explain the concept the student missed. Guide them on the **first one or two correct steps** they should take to solve the problem, stopping just before the final numerical answer. **Do not give the final numerical answer.**
  `,
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const requestBody = MathProblemSubmitRequestSchema.parse(rawBody);

    // 2. Database Lookup with Robust Error Check
    const { data, error } = await supabase
      .from("math_problem_sessions")
      .select(`problem_text, correct_answer`)
      .eq("id", requestBody.session_id)
      .limit(1);

    if (error) {
      // Handle database query error (e.g., connection issue)
      console.error("Supabase query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch problem data." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!data || data.length === 0) {
      // Handle case where session ID is valid but no data is found (404 Not Found)
      return new Response(
        JSON.stringify({ error: "Math problem session not found." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { problem_text: problemText, correct_answer: correctAnswer } =
      data[0];

    // Ensure we are comparing comparable types, though direct comparison is fine
    // if both are strings or numbers as stored/received.
    const isCorrect = String(correctAnswer) === String(requestBody.answer);

    // 3. User Query construction
    const userQuery = `
      Generate personalized tutoring feedback based on the session data below:

      **Problem:** ${problemText}
      **Correct Answer:** ${correctAnswer}
      **User's Attempt:** ${requestBody.answer}
      **Outcome Status:** ${isCorrect ? "CORRECT" : "INCORRECT"}
    `;

    // 4. Execute the streaming prompt
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
            // Robust check for chunk data
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
            fullFeedback += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          // If the Gemini API fails during streaming
          console.error("Gemini stream error:", err);
          controller.error(err);
          return; // Exit start function
        } finally {
          controller.close();

          // 5. Asynchronously insert data after stream completion
          const dataToInsert: InsertType<"math_problem_submissions"> = {
            session_id: requestBody.session_id,
            user_answer: requestBody.answer,
            is_correct: isCorrect,
            feedback_text: fullFeedback,
          };

          // Wrap database insertion in its own try/catch to ensure stream closure isn't blocked
          try {
            await supabase
              .from("math_problem_submissions")
              // Using a simple array insertion. Assuming InsertType is correct.
              .insert([dataToInsert] as never);
          } catch (dbInsertError) {
            console.error("Error inserting submission data:", dbInsertError);
            // Note: Cannot send a 500 status here, as the HTTP headers (status 200)
            // have already been sent to the client. The error should be logged.
          }
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
  } catch (err) {
    // 6. Centralized Error Handling for initial parsing/logic failures
    const errorMessage =
      err instanceof Error ? err.message : "An unknown error occurred.";
    console.error("Request handling error:", err);

    // Use 400 for bad request (e.g., schema validation failure)
    const status =
      err instanceof Error && errorMessage.includes("Invalid JSON") ? 400 : 500;

    return new Response(
      JSON.stringify({ error: `Server error: ${errorMessage}` }),
      {
        status: status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
