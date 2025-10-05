"use client";

import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { api } from "../lib/fetchUtils";
import {
  DIFFICULTY_LEVEL,
  MathProblem,
  MathProblemAPIRequestType,
  MathProblemAPIResponseType,
} from "./types";
import { BannerComponent } from "../components/BannerComponent";

const options: DIFFICULTY_LEVEL[] = ["EASY", "MEDIUM", "HARD"];

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [difficultyLevel, setDifficultyLevel] =
    useState<DIFFICULTY_LEVEL>("MEDIUM");
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isProblemLoading, setIsProblemLoading] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [error, setError] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [feedback, isCorrect]);

  const generateProblem = async () => {
    setIsProblemLoading(true);
    setFeedback("");
    setUserAnswer("");
    setIsCorrect(null);
    setError(false);

    try {
      const newProblem = await api<
        MathProblemAPIRequestType,
        MathProblemAPIResponseType
      >("/api/math-problem", "POST", {
        difficulty_level: difficultyLevel,
      });

      setProblem({
        problem_text: newProblem.problem_text,
        correct_answer: newProblem.correct_answer,
      });

      setSessionId(newProblem.session_id);
    } catch (error) {
      setError(true);
    } finally {
      setIsProblemLoading(false);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    setIsFeedbackLoading(true);
    setFeedback("");
    setIsCorrect(Number(userAnswer) === problem.correct_answer);
    setError(false);

    e.preventDefault();

    try {
      const checkAnswer = await api(
        "/api/math-problem/submit",
        "POST",
        {
          session_id: sessionId,
          answer: Number(userAnswer),
        },
        true
      );

      const reader = checkAnswer.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        setFeedback((prev) => prev + decoder.decode(value));
      }
    } catch (error) {
      setError(true);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Math Problem Generator
        </h1>

        {error && (
          <div className="my-2">
            <BannerComponent message="An error has occured" />
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 flex gap-2 w-full">
          <button
            onClick={generateProblem}
            disabled={isProblemLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            {isProblemLoading ? "Generating..." : "Generate New Problem"}
          </button>
          <div className="inline-flex border rounded-lg select-none">
            {options.map((option) => (
              <button
                key={option}
                className={`px-4 py-2 font-semibold transition-colors duration-200  ${
                  difficultyLevel === option
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-00 hover:bg-gray-300"
                }`}
                onClick={() => setDifficultyLevel(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {problem && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Problem:
            </h2>
            <p className="text-lg text-gray-800 leading-relaxed mb-6">
              {problem.problem_text}
            </p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label
                  htmlFor="answer"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-red"
                  placeholder="Enter your answer"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!userAnswer || isProblemLoading || isFeedbackLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
              >
                {isFeedbackLoading
                  ? "Checking your answer..."
                  : "Submit Answer"}
              </button>
            </form>
          </div>
        )}

        {isCorrect !== null && (
          <div
            className={`rounded-lg shadow-lg p-6 ${isCorrect ? "bg-green-50 border-2 border-green-200" : "bg-yellow-50 border-2 border-yellow-200"}`}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              {isCorrect ? "✅ Correct!" : "❌ Not quite right"}
            </h2>
            <div className="text-gray-800 leading-relaxed prose">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {feedback || "Generating feedback..."}
              </ReactMarkdown>
            </div>
            <div ref={bottomRef} />
          </div>
        )}
      </main>
    </div>
  );
}
