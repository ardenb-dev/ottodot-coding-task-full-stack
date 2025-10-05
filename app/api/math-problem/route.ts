import { GenerateContentConfig, Type } from "@google/genai";
import { executePrompt } from "../../../lib/geminiClient";
import { STRUCTURED_SYLLABUS_DATA } from "./syllabus";
import { InsertType, supabase } from "../../../lib/supabaseClient";
import { MathProblemRequestSchema, MathProblemResponseSchema } from "./schema";

function getAllSubStrandTopics(): { sub_strand: string; topics: string[] }[] {
  return STRUCTURED_SYLLABUS_DATA.map((item) => ({
    sub_strand: item.sub_strand,
    topics: item.topics,
  }));
}

function selectRandomTopics(
  count: number
): { sub_strand: string; topics: string[] }[] {
  const allTopics = getAllSubStrandTopics();
  if (count >= allTopics.length) {
    // If requesting more topics than available, return all (or handle error)
    return allTopics;
  }

  const selectedTopics: { sub_strand: string; topics: string[] }[] = [];
  const availableIndices = Array.from(Array(allTopics.length).keys());

  for (let i = 0; i < count; i++) {
    // Pick a random index from the available ones
    const randomIndex = Math.floor(Math.random() * availableIndices.length);
    const topicIndexInAllTopics = availableIndices[randomIndex];

    // Add the topic to the selected list
    selectedTopics.push(allTopics[topicIndexInAllTopics]);

    // Remove the chosen index from the available pool for next iteration
    availableIndices.splice(randomIndex, 1);
  }

  return selectedTopics;
}

// -----------------------------------------------------------------

const GenerateMathProblemConfig: GenerateContentConfig = {
  responseMimeType: "application/json",
  systemInstruction: `
    You are an expert curriculum designer for Primary 5 students. Your sole task is to generate a high-quality math word problem based on the provided primary math concepts and difficulty level.

    **DIFFICULTY LEVEL DEFINITIONS (STRICTLY ADHERE TO THE ONE REQUESTED):**

    EASY (1 Concept):
    - Requires **one** step of calculation.
    - Uses simple, whole numbers or common fractions.
    - Requires direct application of the core concept.

    MEDIUM (2 Concepts):
    - Requires **two to three** steps of calculation.
    - **Must combine both primary concepts/topics** into a single, cohesive problem.
    - May involve decimals, mixed numbers, or converting between units (e.g., m to cm).

    HARD (3 Concepts):
    - Requires **three or more** complex steps.
    - **Must combine all three primary concepts/topics** into a single, complex problem.
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

export async function POST(request: Request) {
  const rawBody = await request.json();
  const requestBody = MathProblemRequestSchema.parse(rawBody);

  // 1. Determine number of topics based on difficulty
  let topicCount: number;
  switch (requestBody.difficulty_level) {
    case "EASY":
      topicCount = 1;
      break;
    case "MEDIUM":
      topicCount = 2;
      break;
    case "HARD":
      topicCount = 3;
      break;
    default:
      topicCount = 1; // Default to easy if unknown
  }

  // 2. Select the required number of distinct random topics
  const selectedTopics = selectRandomTopics(topicCount);

  // 3. Prepare the topics and context for the prompt
  const primaryConcepts = selectedTopics
    .map((t) => `"${t.sub_strand}"`)
    .join(" and ");

  const contextualKnowledge = selectedTopics
    .flatMap((t) => t.topics)
    .filter((v, i, a) => a.indexOf(v) === i) // Ensure unique list
    .join(", ");

  // 4. Use Google's Gemini AI to generate a math word problem

  const promptContents = `
    Generate a **${requestBody.difficulty_level}** difficulty word problem.

    The problem must strictly adhere to the following **primary math concepts**: ${primaryConcepts}.

    For MEDIUM and HARD difficulty, the problem **must** combine these concepts.

    Use the following related topics as contextual knowledge to ensure accuracy:
    --- CONTEXT ---
    ${contextualKnowledge}
    ---------------
    `;

  const output = await executePrompt({
    contents: promptContents,
    config: GenerateMathProblemConfig,
  });

  const geminiResponse = JSON.parse(output.candidates[0].content.parts[0].text);

  // 5. Save the problem to math_problem_sessions table

  const dataToInsert: InsertType<"math_problem_sessions"> = {
    problem_text: geminiResponse["problem_text"] as string,
    correct_answer: geminiResponse["correct_answer"] as number,
  };

  const { data, error } = await supabase
    .from("math_problem_sessions")
    .insert([dataToInsert] as never)
    .select();

  if (error || !data || data.length === 0) {
    console.error("Supabase insert error:", error);
    // Throw an error or return a 500 response
    return new Response(
      JSON.stringify({ error: "Failed to save problem session." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 6. Return the problem and session ID to the frontend
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
