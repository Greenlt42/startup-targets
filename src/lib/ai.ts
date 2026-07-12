import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL_8B = "llama-3.1-8b-instant";
// gemma2-9b-it was decommissioned by Groq (confirmed via GET /openai/v1/models
// on 2026-07-12) — gpt-oss-20b is its replacement in this tier: still cheaper
// per-token than the 70b model, and its own separate rate-limit bucket.
const GROQ_MODEL_20B = "openai/gpt-oss-20b";
const GROQ_MODEL_70B = "llama-3.3-70b-versatile";

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

// Tried in order until one succeeds. Small models first: this is structured
// extraction, not deep reasoning, so smaller models are plenty accurate for
// it and get far higher free-tier throughput (Groq's limits are per-model,
// not account-wide, so each one is a separate quota bucket). Gemini is last
// since it's currently stuck at 0 free-tier quota (needs billing/API
// enablement checked on the Google Cloud project) — keep it in the chain for
// whenever that's fixed, but don't waste every call's latency on it first.
const PROVIDERS: { name: string; call: (prompt: string) => Promise<string> }[] = [
  { name: `Groq (${GROQ_MODEL_8B})`, call: (prompt) => callGroq(GROQ_MODEL_8B, prompt) },
  { name: `Groq (${GROQ_MODEL_20B})`, call: (prompt) => callGroq(GROQ_MODEL_20B, prompt) },
  { name: `Groq (${GROQ_MODEL_70B})`, call: (prompt) => callGroq(GROQ_MODEL_70B, prompt) },
  { name: "Gemini", call: callGemini },
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
