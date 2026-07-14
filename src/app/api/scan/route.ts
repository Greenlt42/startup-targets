import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAllArticles, fetchAllListingSourceArticles } from "@/lib/feeds";
import { loadInvestorMatcher } from "@/lib/matchInvestors";
import { newScanStats, excludeAlreadySeen, processArticle } from "@/lib/pipeline";

const FIRST_RUN_LOOKBACK_DAYS = 60;

// 60s is the max Vercel allows on the Hobby plan (Pro allows up to 300s).
// Real runs have taken well over this when processing a large backlog (e.g.
// the initial catch-up, or a day with heavy AI-provider fallback) — that
// first big run should be triggered manually against production rather than
// relying on cron, so it isn't silently killed mid-scan. Steady-state daily
// runs (a handful of new articles) should comfortably fit in 60s.
export const maxDuration = 60;

// GitHub Actions' `schedule` trigger doesn't fire at exact intervals —
// confirmed live: against a 2-hourly cron, actual gaps between runs ranged
// 1h20m–4h30m. A longer-than-expected gap means more of a backlog to work
// through, and two consecutive runs got killed by FUNCTION_INVOCATION_TIMEOUT
// as a result (2026-07-13). Capping articles-per-run keeps duration
// predictable regardless of how much cron drifts or how large the backlog
// gets — see the scannedAt logic below for how a capped run stays retryable.
const MAX_ARTICLES_PER_RUN = 25;

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

  const stats = { fetched: 0, withinWindow: 0, newArticles: 0, ...newScanStats() };

  const [feedArticles, listingArticles] = await Promise.all([fetchAllArticles(), fetchAllListingSourceArticles()]);
  const allArticles = [...feedArticles, ...listingArticles];
  stats.fetched = allArticles.length;

  const candidates = allArticles.filter((a) => a.publishedAt === null || a.publishedAt >= cutoff);
  stats.withinWindow = candidates.length;

  const newArticles = await excludeAlreadySeen(candidates);
  stats.newArticles = newArticles.length;

  const articlesToProcess = newArticles.slice(0, MAX_ARTICLES_PER_RUN);
  const capped = articlesToProcess.length < newArticles.length;

  const matcher = await loadInvestorMatcher();

  for (const article of articlesToProcess) {
    await processArticle(article, matcher, stats);
  }

  // Only advance the cutoff on a clean, uncapped run. If anything errored,
  // or we intentionally stopped short of the full backlog, leave
  // last_scan_date where it was — the next run re-fetches the same window,
  // but dedup (seen_articles) already skips everything that succeeded, so
  // it just picks up the next batch until it finally catches up in full.
  let scannedAt: string | null = null;
  if (stats.errors.length === 0 && !capped) {
    scannedAt = new Date().toISOString();
    await supabase.from("scan_state").update({ last_scan_date: scannedAt }).eq("id", 1);
  }

  return NextResponse.json({ ok: true, previousScanDate: state?.last_scan_date ?? null, scannedAt, capped, stats });
}
