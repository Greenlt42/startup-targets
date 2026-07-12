import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL_PRIMARY = "llama-3.3-70b-versatile";
const GROQ_MODEL_SECONDARY = "llama-3.1-8b-instant";

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

async function callGemini(prompt: string): Promise<string> {
  const model = getGemini().getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callGroq(model: string, prompt: string): Promise<string> {
  const completion = await getGroq().chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? "";
}

// Tried in order until one succeeds. Groq's rate/token limits are per-model,
// not account-wide, so a second (smaller) Groq model gets its own separate
// daily quota for free — cheap extra headroom before needing another provider.
const PROVIDERS: { name: string; call: (prompt: string) => Promise<string> }[] = [
  { name: "Gemini", call: callGemini },
  { name: `Groq (${GROQ_MODEL_PRIMARY})`, call: (prompt) => callGroq(GROQ_MODEL_PRIMARY, prompt) },
  { name: `Groq (${GROQ_MODEL_SECONDARY})`, call: (prompt) => callGroq(GROQ_MODEL_SECONDARY, prompt) },
];

export async function generateText(prompt: string): Promise<string> {
  let lastErr: unknown;
  for (const provider of PROVIDERS) {
    try {
      return await provider.call(prompt);
    } catch (err) {
      console.error(`${provider.name} call failed:`, err instanceof Error ? err.message : err);
      lastErr = err;
    }
  }
  throw lastErr;
}
