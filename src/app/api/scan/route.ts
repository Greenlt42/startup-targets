import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAllArticles, fetchAllListingSourceArticles } from "@/lib/feeds";
import { loadInvestorMatcher } from "@/lib/matchInvestors";
import { newScanStats, excludeAlreadySeen, processArticle } from "@/lib/pipeline";

const FIRST_RUN_LOOKBACK_DAYS = 60;

// Safety margin for the incremental cutoff: an article's publishedAt is
// supposed to reliably predict when it becomes visible in the feed, but
// CMS republishing/backdating can violate that — confirmed live 2026-08-14,
// EU-Startups' Mindgard article carried publishedAt Aug 13 07:34 but didn't
// actually appear in the feed until Aug 14, by which point the prior clean
// run had already advanced last_scan_date past it, permanently excluding
// it from every future scan's withinWindow filter (it was never in
// seen_articles either, so dedup wouldn't have caught it — it just fell
// through). Capping the cutoff to at most this many days behind "now"
// bounds that exposure. Cheap to do: the wider candidate pool only costs
// extra seen_articles lookups, not extra AI extraction, since
// excludeAlreadySeen filters already-processed articles out first.
const CUTOFF_SAFETY_LOOKBACK_DAYS = 3;

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
// as a result (2026-07-13). Capping articles-per-run was meant to keep
// duration predictable — see the scannedAt logic below for how a capped run
// stays retryable — but a fixed article count alone wasn't enough: confirmed
// live (2026-07-14) that a run still hit FUNCTION_INVOCATION_TIMEOUT well
// under the 25-article cap, because per-article time varies hugely with how
// much AI-provider fallback cascading happens (each failed attempt in the
// chain is real added latency). A wall-clock time budget targets the actual
// constraint directly instead of using article count as an imperfect proxy
// for it; the count cap stays on as a secondary bound.
const MAX_ARTICLES_PER_RUN = 25;
// The check only runs *between* articles, not during one — a single slow
// article (multiple provider fallback attempts in sequence, each with its
// own network round-trip) can still overshoot past this point before the
// next check fires. 35s leaves real margin for that in-flight tail latency
// on top of the ~15s already reserved for the final response/DB write.
const TIME_BUDGET_MS = 35_000;

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
  const startTime = Date.now();

  const { data: state } = await supabase
    .from("scan_state")
    .select("last_scan_date")
    .eq("id", 1)
    .single();

  const rawCutoff = state?.last_scan_date
    ? new Date(state.last_scan_date)
    : new Date(Date.now() - FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const safetyFloor = new Date(Date.now() - CUTOFF_SAFETY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const cutoff = rawCutoff < safetyFloor ? rawCutoff : safetyFloor;

  const stats = { fetched: 0, withinWindow: 0, newArticles: 0, ...newScanStats() };

  const [feedArticles, listingArticles] = await Promise.all([fetchAllArticles(), fetchAllListingSourceArticles()]);
  const allArticles = [...feedArticles, ...listingArticles];
  stats.fetched = allArticles.length;

  const candidates = allArticles.filter((a) => a.publishedAt === null || a.publishedAt >= cutoff);
  stats.withinWindow = candidates.length;

  const newArticles = await excludeAlreadySeen(candidates);
  stats.newArticles = newArticles.length;

  // Shuffle before capping — confirmed live: with feed sources concatenated
  // before listing sources and a plain slice(0, N), any run where RSS alone
  // produced ≥N new candidates gave a listing source (e.g. Scaling Europe,
  // added 2026-07-14) zero chance of a slot, run after run. A shuffle gives
  // every source fair odds each run regardless of array position.
  const shuffled = [...newArticles].sort(() => Math.random() - 0.5);
  const articlesToProcess = shuffled.slice(0, MAX_ARTICLES_PER_RUN);
  let capped = articlesToProcess.length < newArticles.length;

  const matcher = await loadInvestorMatcher();

  for (const article of articlesToProcess) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      capped = true;
      break;
    }
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
