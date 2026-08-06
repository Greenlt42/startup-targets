// Re-runs already-processed articles from the last N days back through the
// extraction+filter+upsert pipeline. Useful after widening a filter (e.g.
// the investors allowlist) — the regular scan route would otherwise skip
// these articles forever via the seen_articles dedup, even though the
// updated filters might now qualify deals that previously got rejected.
//
// Re-extracting is safe to repeat: markArticleSeen and the targets upsert
// both use ignoreDuplicates, so an article/deal that already succeeded is
// just a no-op the second time.
//
// Run manually: npx tsx scripts/reprocess-recent.ts [days]

import { readFileSync } from "fs";
import { supabase } from "../src/lib/supabase";
import { loadInvestorMatcher } from "../src/lib/matchInvestors";
import { processArticle, newScanStats } from "../src/lib/pipeline";
import type { Article } from "../src/lib/feeds";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(i + 1).trim();
}

const DAYS = Number(process.argv[2]) || 7;

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("seen_articles")
    .select("url, source, published_at")
    .gte("processed_at", since)
    .order("processed_at", { ascending: true });
  if (error) throw error;

  const articles: Article[] = (data ?? []).map((row) => ({
    sourceName: row.source as string,
    url: row.url as string,
    title: "",
    publishedAt: row.published_at ? new Date(row.published_at as string) : null,
    text: "", // empty — always triggers processArticle's full-page-fetch enrichment
  }));

  console.log(`Reprocessing ${articles.length} articles seen in the last ${DAYS} days\n`);

  const matcher = await loadInvestorMatcher();
  const stats = newScanStats();

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const before = stats.targetsUpserted;
    process.stdout.write(`[${i + 1}/${articles.length}] ${article.sourceName}: ${article.url.slice(0, 100)} ... `);
    await processArticle(article, matcher, stats);
    console.log(stats.targetsUpserted > before ? "TARGET FOUND" : "-");
  }

  console.log("\n=== Final stats ===");
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
