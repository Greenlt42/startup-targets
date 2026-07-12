import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

let gemini: GoogleGenerativeAI | null = null;
let groq: Groq | null = null;

// Lazily initialized so the app can build/start before the API key env vars are set.
function getGemini(): GoogleGenerativeAI {
  if (!gemini) gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  return gemini;
}
function getGroq(): Groq {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  return groq;
}

// Gemini (Google AI Studio) is primary; Groq is the fallback if Gemini errors or rate-limits.
export async function generateText(prompt: string): Promise<string> {
  try {
    const model = getGemini().getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini call failed, falling back to Groq:", err);
    const completion = await getGroq().chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0]?.message?.content ?? "";
  }
}
