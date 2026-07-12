import { supabase } from "./supabase";
import { fetchFullArticleText, type Article } from "./feeds";
import { extractDeals, STAGES } from "./extract";
import { convertToUsd } from "./fx";
import type { InvestorMatcher } from "./matchInvestors";

export const MAX_ROUND_SIZE_USD = 50_000_000;
export const MAX_HEADCOUNT = 60;
// Below this, an RSS item's title+body is too thin for reliable extraction
// (e.g. TechCrunch's feed gives ~100-char teasers with no content:encoded) —
// worth the extra request to fetch the full article page instead.
export const MIN_TEXT_LENGTH_BEFORE_FULL_FETCH = 400;

export interface ScanStats {
  dealsExtracted: number;
  targetsUpserted: number;
  // Why an extracted deal didn't become a target — visibility into the
  // filter funnel so recall issues can be diagnosed instead of guessed at.
  rejections: {
    badStage: number; // no stage, or not pre-seed/seed/series-a
    noInvestorMatch: number; // none of the deal's investors are on the allowlist
    headcountTooHigh: number;
    noCurrencyForStatedAmount: number; // amount given but currency missing
    unrecognizedCurrency: number; // currency not in our FX table
    roundTooLarge: number; // over the $50M cap
    noDate: number; // couldn't determine a round_date at all
    duplicateAcrossSources: number; // same company (case-insensitive) + a round_date within days, different source
  };
  errors: string[];
}

export function newScanStats(): ScanStats {
  return {
    dealsExtracted: 0,
    targetsUpserted: 0,
    rejections: {
      badStage: 0,
      noInvestorMatch: 0,
      headcountTooHigh: 0,
      noCurrencyForStatedAmount: 0,
      unrecognizedCurrency: 0,
      roundTooLarge: 0,
      noDate: 0,
      duplicateAcrossSources: 0,
    },
    errors: [],
  };
}

// Different sources often cover the same real-world round with slightly
// different company-name capitalization or a round_date off by a day or two
// — the DB's exact-match unique constraint (company_name, round_date) won't
// catch that. Confirmed live: "TRIMTECH Therapeutics" vs "Trimtech
// Therapeutics" (same date, different case) and "Astral Systems" reported a
// day apart by two sources both slipped through as separate rows. Check
// case-insensitively within a tolerance window before inserting.
const DUPLICATE_DATE_TOLERANCE_DAYS = 7;

async function hasDuplicateTarget(companyName: string, roundDate: string): Promise<boolean> {
  const date = new Date(`${roundDate}T00:00:00Z`);
  const from = new Date(date.getTime() - DUPLICATE_DATE_TOLERANCE_DAYS * 86400000).toISOString().slice(0, 10);
  const to = new Date(date.getTime() + DUPLICATE_DATE_TOLERANCE_DAYS * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("targets")
    .select("id")
    .ilike("company_name", companyName)
    .gte("round_date", from)
    .lte("round_date", to)
    .limit(1);

  if (error) throw error;
  return (data ?? []).length > 0;
}

const SEEN_CHECK_BATCH_SIZE = 100;

// Returns only the articles NOT already present in seen_articles. Batches
// the lookup — PostgREST encodes an .in() filter in the query string, and a
// large candidate pool (e.g. the historical backfill script's few hundred
// discovered URLs) risks exceeding URL length limits in one shot.
export async function excludeAlreadySeen(articles: Article[]): Promise<Article[]> {
  if (articles.length === 0) return [];

  const seenUrls = new Set<string>();
  for (let i = 0; i < articles.length; i += SEEN_CHECK_BATCH_SIZE) {
    const batch = articles.slice(i, i + SEEN_CHECK_BATCH_SIZE);
    const { data, error } = await supabase
      .from("seen_articles")
      .select("url")
      .in("url", batch.map((a) => a.url));

    if (error) throw error;
    for (const row of data ?? []) seenUrls.add(row.url as string);
  }

  return articles.filter((a) => !seenUrls.has(a.url));
}

export async function markArticleSeen(article: Article): Promise<void> {
  const { error } = await supabase
    .from("seen_articles")
    .upsert({ url: article.url, source: article.sourceName, published_at: article.publishedAt }, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw error;
}

// Processes one article end-to-end: optional full-text enrichment, AI
// extraction, per-deal filtering + upsert into targets, and marks the
// article seen iff every deal in it saved successfully (a partial failure
// keeps the whole article eligible for retry — safe, since ignoreDuplicates
// makes re-saving already-successful deals a no-op). Shared between the
// scheduled scan route and the one-time historical backfill script so both
// apply identical rules.
export async function processArticle(article: Article, matcher: InvestorMatcher, stats: ScanStats): Promise<void> {
  let enriched = article;
  let articleClean = true;
  try {
    if (enriched.text.length < MIN_TEXT_LENGTH_BEFORE_FULL_FETCH) {
      const fullText = await fetchFullArticleText(enriched.url);
      if (fullText) enriched = { ...enriched, text: fullText };
    }

    const deals = await extractDeals(enriched);
    stats.dealsExtracted += deals.length;

    for (const deal of deals) {
      if (!deal.stage || !STAGES.includes(deal.stage)) {
        stats.rejections.badStage++;
        continue;
      }

      const matchedInvestor = matcher.match(deal.investors);
      if (!matchedInvestor) {
        stats.rejections.noInvestorMatch++;
        continue;
      }

      if (deal.headcount !== null && deal.headcount > MAX_HEADCOUNT) {
        stats.rejections.headcountTooHigh++;
        continue;
      }

      let roundSizeUsd: number | null = null;
      if (deal.roundAmount !== null) {
        if (!deal.roundCurrency) {
          stats.rejections.noCurrencyForStatedAmount++;
          continue;
        }
        roundSizeUsd = convertToUsd(deal.roundAmount, deal.roundCurrency);
        if (roundSizeUsd === null) {
          stats.rejections.unrecognizedCurrency++;
          continue;
        }
        if (roundSizeUsd > MAX_ROUND_SIZE_USD) {
          stats.rejections.roundTooLarge++;
          continue;
        }
      }

      const roundDate = deal.roundDate ?? enriched.publishedAt?.toISOString().slice(0, 10) ?? null;
      if (!roundDate) {
        stats.rejections.noDate++;
        continue;
      }

      if (await hasDuplicateTarget(deal.companyName, roundDate)) {
        stats.rejections.duplicateAcrossSources++;
        continue;
      }

      const { error } = await supabase.from("targets").upsert(
        {
          company_name: deal.companyName,
          website: deal.website,
          sector: deal.sector,
          stage: deal.stage,
          round_size_usd: roundSizeUsd,
          round_date: roundDate,
          investors: deal.investors,
          headcount: deal.headcount,
          source_url: enriched.url,
          source_name: enriched.sourceName,
          summary: deal.summary,
        },
        { onConflict: "company_name,round_date", ignoreDuplicates: true }
      );

      if (error) {
        stats.errors.push(`Upsert failed for ${deal.companyName}: ${error.message}`);
        articleClean = false;
      } else {
        stats.targetsUpserted++;
      }
    }

    if (articleClean) await markArticleSeen(enriched);
  } catch (err) {
    stats.errors.push(`Extraction failed for ${enriched.url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
