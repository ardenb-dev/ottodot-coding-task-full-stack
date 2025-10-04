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
import { STRUCTURED_SYLLABUS_DATA } from "./syllabus";
import { InsertType, supabase } from "../../../lib/supabaseClient";
import { MathProblemRequestSchema, MathProblemResponseSchema } from "./schema";

const GenerateMathProblemConfig: GenerateContentConfig = {
  responseMimeType: "application/json",
  systemInstruction: `
    You are an expert curriculum designer for Primary 5 students. Your sole task is to generate a high-quality math word problem based on the provided topic and difficulty level.

    **DIFFICULTY LEVEL DEFINITIONS (STRICTLY ADHERE TO THE ONE REQUESTED):**
    
    EASY:
    - Requires **one** step of calculation.
    - Uses simple, whole numbers or common fractions.
    - Requires direct application of the core concept.
    
    MEDIUM:
    - Requires **two to three** steps of calculation.
    - May involve decimals, mixed numbers, or converting between units (e.g., m to cm).
    - Requires combining two closely related concepts (e.g., area of a square then subtraction).
    
    HARD:
    - Requires **three or more** complex steps.
    - Involves non-standard units, large numbers, or a multi-part calculation leading to a final answer.
    - The problem wording should be deliberately challenging or involve an unfamiliar scenario.

    **STRICT OUTPUT FORMATTING RULE:**
    The answer for 'correct_answer' in the JSON schema **must be a plain, unit-less numerical value**. Do not include any text, unit symbols, or explanatory words.
    `,
  temperature: 0.7,
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

// TODO Obfuscate response
export async function POST(request: Request) {
  const rawBody = await request.json();
  const requestBody = MathProblemRequestSchema.parse(rawBody);

  // Get a random index
  const randomIndex = Math.floor(
    Math.random() * STRUCTURED_SYLLABUS_DATA.length
  );

  // Get the element at the random index
  const randomTopic = STRUCTURED_SYLLABUS_DATA[randomIndex];

  // 1. Use Google's Gemini AI to generate a math word problem

  const promptContents = `
    Generate a **${requestBody.difficulty_level}** difficulty word problem.

    The problem must strictly and only adhere to the **primary math concept**: "${randomTopic.sub_strand}". 

    Use the following related topics as contextual knowledge to ensure accuracy:
    --- CONTEXT ---
    ${randomTopic.topics.join(",")}
    ---------------    `;

  const output = await executePrompt({
    contents: promptContents,
    config: GenerateMathProblemConfig,
  });

  const geminiResponse = JSON.parse(output.candidates[0].content.parts[0].text);

  const dataToInsert: InsertType<"math_problem_sessions"> = {
    problem_text: geminiResponse["problem_text"] as string,
    correct_answer: geminiResponse["correct_answer"] as number,
  };

  const { data } = await supabase
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
