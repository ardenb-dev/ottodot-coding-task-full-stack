import { GenerateContentParameters, GoogleGenAI } from "@google/genai";

// Ensure the API key is only accessed on the server environment.
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

// Initialize the GoogleGenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Get a specific model service instance
export const executePrompt = (
  parameters: Omit<GenerateContentParameters, "model">
) => {
  return ai.models.generateContent({
    model: "gemini-2.5-flash",
    ...parameters,
  });
};

// You can export other services like image generation or embeddings here
// export const imageGenerator = ai.models.getImageModel({ model: "imagen-3.0-generate-002" });
