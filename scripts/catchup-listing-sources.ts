// One-time catch-up for listing sources (see LISTING_SOURCES in
// src/lib/sources.ts): processes every currently-discoverable article with
// no cap, bypassing the regular scan route's MAX_ARTICLES_PER_RUN. Useful
// right after adding a new listing source, so its backlog doesn't have to
// wait on the regular cron's shuffle to eventually give it enough slots.
//
// Run manually: npx tsx scripts/catchup-listing-sources.ts

import { readFileSync } from "fs";
import { fetchAllListingSourceArticles } from "../src/lib/feeds";
import { loadInvestorMatcher } from "../src/lib/matchInvestors";
import { excludeAlreadySeen, processArticle, newScanStats } from "../src/lib/pipeline";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(i + 1).trim();
}

async function main() {
  const allArticles = await fetchAllListingSourceArticles();
  console.log(`${allArticles.length} articles discovered across listing sources`);

  const newArticles = await excludeAlreadySeen(allArticles);
  console.log(`${newArticles.length} not already seen\n`);

  const matcher = await loadInvestorMatcher();
  const stats = newScanStats();

  for (let i = 0; i < newArticles.length; i++) {
    const article = newArticles[i];
    const before = stats.targetsUpserted;
    process.stdout.write(`[${i + 1}/${newArticles.length}] ${article.sourceName}: ${article.url.slice(0, 100)} ... `);
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
