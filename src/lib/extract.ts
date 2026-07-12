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

Only include rounds where the company's sector plausibly fits one of these
five categories: "deep tech", "climate", "defence", "energy", "biotech". Skip
rounds in unrelated sectors (e.g. consumer apps, fintech, martech) entirely —
do not include them in the array.

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

function parseJsonArray(raw: string): unknown[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
  return parsed;
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

  return parsed.filter(isValidDeal).map((d) => ({
    companyName: d.companyName.trim(),
    website: d.website ?? null,
    sector: d.sector,
    stage: d.stage,
    roundAmount: typeof d.roundAmount === "number" ? d.roundAmount : null,
    roundCurrency: d.roundCurrency ?? null,
    roundDate: d.roundDate ?? null,
    investors: d.investors.filter((i): i is string => typeof i === "string"),
    headcount: typeof d.headcount === "number" ? d.headcount : null,
    summary: typeof d.summary === "string" ? d.summary : "",
  }));
}
