import { generateText } from "./ai";

export const SECTORS = ["deep tech", "climate", "defence", "energy", "biotech"] as const;
export const STAGES = ["pre-seed", "seed", "series-a"] as const;

export interface ExtractedDeal {
  companyName: string;
  website: string | null;
  sector: (typeof SECTORS)[number] | null;
  stage: (typeof STAGES)[number] | null;
  roundAmount: number | null;
  roundCurrency: string | null;
  roundDate: string | null; // YYYY-MM-DD
  investors: string[];
  headcount: number | null;
  summary: string;
}

const PROMPT_HEADER = `You extract structured funding-round data from startup news articles.

The article below may describe ONE funding round, MULTIPLE funding rounds
(some sources publish weekly round-up posts covering many companies), or NO
funding round at all (e.g. opinion pieces, general startup-ecosystem advice).

Return a JSON array with one object per distinct funding round found. Return
an empty array [] if the article contains no funding announcement.

Only include rounds where the company's core product or technology genuinely
IS one of these five categories: "deep tech", "climate", "defence", "energy",
"biotech". Being adjacent to, serving, or operating within one of these
industries is NOT enough — the company's own product must be the deep tech /
climate tech / defence tech / energy tech / biotech itself.

For example: a company building carbon-capture hardware IS climate tech; a
staffing agency, training program, consultancy, generic SaaS/CRM tool, or
marketplace that merely serves the climate/energy/defence/biotech industry is
NOT — skip those, even though the article may describe them as operating "in
climate" or "in energy." When in doubt, ask: if you removed the industry
buzzwords, would this still describe deep tech / climate / defence / energy /
biotech engineering, science, or hardware — or does it describe generic
software/services/workforce operations that happen to have that industry as a
customer? If the latter, skip it.

Skip rounds in unrelated sectors (e.g. consumer apps, fintech, martech)
entirely — do not include them in the array.

Each object must have exactly these fields:
{
  "companyName": string,
  "website": string or null (only if a URL/domain is explicitly mentioned),
  "sector": one of "deep tech" | "climate" | "defence" | "energy" | "biotech",
  "stage": one of "pre-seed" | "seed" | "series-a" | null (null if the article
    doesn't specify or it's a different stage, e.g. Series B or growth),
  "roundAmount": number or null (the numeric amount only, e.g. 5.25, not "£5.25M"),
  "roundCurrency": ISO currency code or null (e.g. "USD", "EUR", "GBP"),
  "roundDate": "YYYY-MM-DD" or null (use the article's publish date if the
    article doesn't state an exact round date),
  "investors": array of investor/fund names mentioned as backing this round
    (use the names as written in the article, full firm names where given),
  "headcount": number or null (only if the article explicitly states company
    headcount/team size — do not guess),
  "summary": one-sentence plain description of what the company does
}

Note: roundAmount is in whatever unit is stated (if the article says "$5M",
roundAmount is 5, not 5000000 — always treat the stated figure as millions
unless it's explicitly a different unit).

Respond with ONLY the JSON array, no other text, no markdown code fences.

Article (source: {{SOURCE}}, published: {{PUBLISHED}}):
---
{{ARTICLE}}
---`;

// Smaller models occasionally emit non-standard JSON — inline `//` comments
// (seen from llama-3.1-8b-instant) or a trailing comma before a closing
// bracket. Strips both, respecting string boundaries so a `//` inside a URL
// value (e.g. "https://example.com") isn't mistaken for a comment.
function stripJsonComments(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && s[i + 1] === "/") {
      while (i < s.length && s[i] !== "\n") i++;
    } else if (ch === "/" && s[i + 1] === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

function parseJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const cleaned = stripJsonComments(trimmed).replace(/,(\s*[\]}])/g, "$1");
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
  return parsed;
}

// Smaller models sometimes emit the literal string "null" instead of the
// JSON null value for optional fields — e.g. "roundDate": "null", which
// would otherwise flow straight into a date column and fail at the DB.
// Normalize any nullable-string field before validating/using it.
function nullableString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" || trimmed.toLowerCase() === "null" ? null : trimmed;
}

function isValidDeal(d: unknown): d is ExtractedDeal {
  if (typeof d !== "object" || d === null) return false;
  const deal = d as Record<string, unknown>;
  return (
    typeof deal.companyName === "string" &&
    deal.companyName.trim().length > 0 &&
    (deal.sector === null || SECTORS.includes(deal.sector as (typeof SECTORS)[number])) &&
    (deal.stage === null || STAGES.includes(deal.stage as (typeof STAGES)[number])) &&
    Array.isArray(deal.investors)
  );
}

export async function extractDeals(
  article: { sourceName: string; publishedAt: Date | null; text: string }
): Promise<ExtractedDeal[]> {
  const prompt = PROMPT_HEADER
    .replace("{{SOURCE}}", article.sourceName)
    .replace("{{PUBLISHED}}", article.publishedAt?.toISOString().slice(0, 10) ?? "unknown")
    .replace("{{ARTICLE}}", article.text.slice(0, 6000));

  const raw = await generateText(prompt);

  let parsed: unknown[];
  try {
    parsed = parseJsonArray(raw);
  } catch (err) {
    console.error("Failed to parse extraction response as JSON:", err, "\nRaw response:", raw.slice(0, 500));
    return [];
  }

  // Normalize nullable-string fields (collapsing literal "null" strings to
  // real null) before validation, so a stray "null" string on an optional
  // field like sector/stage doesn't cause an otherwise-valid deal to be
  // rejected wholesale.
  const normalized = parsed.map((d) => {
    if (typeof d !== "object" || d === null) return d;
    const deal = d as Record<string, unknown>;
    return {
      ...deal,
      sector: nullableString(deal.sector),
      stage: nullableString(deal.stage),
      website: nullableString(deal.website),
      roundCurrency: nullableString(deal.roundCurrency),
      roundDate: nullableString(deal.roundDate),
    };
  });

  return normalized.filter(isValidDeal).map((d) => ({
    companyName: d.companyName.trim(),
    website: d.website,
    sector: d.sector,
    stage: d.stage,
    roundAmount: typeof d.roundAmount === "number" ? d.roundAmount : null,
    roundCurrency: d.roundCurrency,
    roundDate: d.roundDate,
    investors: d.investors.filter((i): i is string => typeof i === "string"),
    headcount: typeof d.headcount === "number" ? d.headcount : null,
    summary: typeof d.summary === "string" ? d.summary : "",
  }));
}
