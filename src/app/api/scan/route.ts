import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAllArticles, type Article } from "@/lib/feeds";
import { extractDeals, STAGES } from "@/lib/extract";
import { loadInvestorMatcher } from "@/lib/matchInvestors";
import { convertToUsd } from "@/lib/fx";

const MAX_ROUND_SIZE_USD = 50_000_000;
const MAX_HEADCOUNT = 60;
const FIRST_RUN_LOOKBACK_DAYS = 60;

// 60s is the max Vercel allows on the Hobby plan (Pro allows up to 300s).
// Real runs have taken well over this when processing a large backlog (e.g.
// the initial catch-up, or a day with heavy AI-provider fallback) — that
// first big run should be triggered manually against production rather than
// relying on cron, so it isn't silently killed mid-scan. Steady-state daily
// runs (a handful of new articles) should comfortably fit in 60s.
export const maxDuration = 60;

// Triggered by a scheduled GitHub Actions workflow (.github/workflows/scan.yml)
// hitting this route with a shared secret.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SCAN_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return await runScan();
  } catch (err) {
    // Belt-and-braces: nothing above should throw uncaught (per-article
    // extraction/upsert errors are already caught individually), but if
    // something unexpected does escape, return it as JSON instead of
    // crashing into an opaque 500 with no diagnostic info.
    console.error("Scan failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function runScan(): Promise<NextResponse> {
  const { data: state } = await supabase
    .from("scan_state")
    .select("last_scan_date")
    .eq("id", 1)
    .single();

  const cutoff = state?.last_scan_date
    ? new Date(state.last_scan_date)
    : new Date(Date.now() - FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const stats = {
    fetched: 0,
    withinWindow: 0,
    newArticles: 0,
    dealsExtracted: 0,
    targetsUpserted: 0,
    // Why an extracted deal didn't become a target — visibility into the
    // filter funnel so recall issues can be diagnosed instead of guessed at.
    rejections: {
      badStage: 0, // no stage, or not pre-seed/seed/series-a
      noInvestorMatch: 0, // none of the deal's investors are on the allowlist
      headcountTooHigh: 0,
      noCurrencyForStatedAmount: 0, // amount given but currency missing
      unrecognizedCurrency: 0, // currency not in our FX table
      roundTooLarge: 0, // over the $50M cap
      noDate: 0, // couldn't determine a round_date at all
    },
    errors: [] as string[],
  };

  const allArticles = await fetchAllArticles();
  stats.fetched = allArticles.length;

  const candidates = allArticles.filter((a) => a.publishedAt === null || a.publishedAt >= cutoff);
  stats.withinWindow = candidates.length;

  const newArticles = await excludeAlreadySeen(candidates);
  stats.newArticles = newArticles.length;

  const matcher = await loadInvestorMatcher();

  for (const article of newArticles) {
    let articleClean = true;
    try {
      const deals = await extractDeals(article);
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

        const roundDate = deal.roundDate ?? article.publishedAt?.toISOString().slice(0, 10) ?? null;
        if (!roundDate) {
          stats.rejections.noDate++;
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
            source_url: article.url,
            source_name: article.sourceName,
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

      // Only mark as seen once every deal in the article was actually saved
      // — an article with a partial failure (e.g. one deal's upsert errors)
      // needs to stay eligible for retry, since ignoreDuplicates makes
      // re-processing the deals that already succeeded a safe no-op.
      if (articleClean) await markArticleSeen(article);
    } catch (err) {
      stats.errors.push(`Extraction failed for ${article.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Only advance the cutoff on a clean run. If anything errored, leave
  // last_scan_date where it was — the next run will re-fetch the same
  // window, but dedup (seen_articles) already skips everything that
  // succeeded, so only the articles that actually failed get retried.
  let scannedAt: string | null = null;
  if (stats.errors.length === 0) {
    scannedAt = new Date().toISOString();
    await supabase.from("scan_state").update({ last_scan_date: scannedAt }).eq("id", 1);
  }

  return NextResponse.json({ ok: true, previousScanDate: state?.last_scan_date ?? null, scannedAt, stats });
}

// Returns only the articles NOT already present in seen_articles.
async function excludeAlreadySeen(articles: Article[]): Promise<Article[]> {
  if (articles.length === 0) return [];

  const { data, error } = await supabase
    .from("seen_articles")
    .select("url")
    .in("url", articles.map((a) => a.url));

  if (error) throw error;

  const seenUrls = new Set((data ?? []).map((row) => row.url as string));
  return articles.filter((a) => !seenUrls.has(a.url));
}

async function markArticleSeen(article: Article): Promise<void> {
  const { error } = await supabase
    .from("seen_articles")
    .upsert({ url: article.url, source: article.sourceName, published_at: article.publishedAt }, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw error;
}
