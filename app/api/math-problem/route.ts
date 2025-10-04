/**
    POST /api/math-problem (Generate Problem)
        Use Google's Gemini AI to generate a math word problem
        The AI should return JSON with:
            {
            "problem_text": "A bakery sold 45 cupcakes...",
            "correct_answer": 15
            }
        Save the problem to math_problem_sessions table
        Return the problem and session ID to the frontend

    Edge cases to consider: 
    1. If repeating decimals, state how many decimals
 */

import { GenerateContentConfig, Type } from "@google/genai";
import { executePrompt } from "../../../lib/geminiClient";
import { FULL_SYLLABUS_TEXT } from "./syllabus";
import * as z from "zod";
import { InsertType, supabase } from "../../../lib/supabaseClient";

const GenerateMathProblemConfig: GenerateContentConfig = {
  responseMimeType: "application/json",
  systemInstruction: `
  You are an expert curriculum designer for Primary 5 students. Your sole task is to generate high-quality math word problems based on the rules below.

  **PRIMARY RULE: KNOWLEDGE CONFINEMENT**
  You must **only** generate problems that strictly relate to and fall under one of the four approved curriculum topics listed below.

  **APPROVED CURRICULUM TOPICS:**
  1. Fractions (Addition and Subtraction of mixed numbers only)
  2. Decimals (Money problems only, ensuring the total is over $100)
  3. Ratios (Solving for an unknown quantity using a given ratio)
  4. Area and Perimeter (Compound shapes made of two rectangles)

  **STRICT OUTPUT FORMATTING RULE:**
  The answer you generate for the 'correct_answer' field in the JSON schema **must be a plain, unit-less numerical value**. Do not include any text, unit symbols (like 'cm', 'kg', '$', or 'litres'), or explanatory words in the final answer—only the number itself.
`,
  temperature: 0.5,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      problem_text: {
        type: Type.STRING,
      },
      correct_answer: {
        type: Type.NUMBER,
      },
    },
  },
};

const MathProblemResponseSchema = z.object({
  problem_text: z.string(),
  correct_answer: z.number(),
  session_id: z.uuid(),
});

// TODO Select random topic
export async function POST(request: Request) {
  // 1. Use Google's Gemini AI to generate a math word problem
  const output = await executePrompt({
    contents: `
    Generate a word problem.

    The problem must strictly adhere to ONE random sub-topic chosen from the following syllabus. 

    --- SYLLABUS REFERENCE ---
    ${FULL_SYLLABUS_TEXT}
    ---------------------------
    `,
    config: GenerateMathProblemConfig,
  });

  const geminiResponse = JSON.parse(output.candidates[0].content.parts[0].text);

  const dataToInsert: InsertType<"math_problem_sessions"> = {
    problem_text: geminiResponse["problem_text"] as string,
    correct_answer: geminiResponse["correct_answer"] as number,
  };

  const { data, error } = await supabase
    .from("math_problem_sessions")
    .insert([dataToInsert] as never)
    .select();

  //   Return the problem and session ID to the frontend
  const resultSet = MathProblemResponseSchema.parse({
    problem_text: geminiResponse["problem_text"],
    correct_answer: geminiResponse["correct_answer"],
    session_id: data[0]["id"],
  });

  return new Response(JSON.stringify(resultSet), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
