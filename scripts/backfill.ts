// One-time historical backfill: paginates through each source's archive
// pages (going back further than what the live RSS feed currently exposes)
// and runs discovered article URLs through the same extraction/filtering
// pipeline as the ongoing scan (src/lib/pipeline.ts) — same rules, same
// seen_articles dedup, same targets upsert.
//
// Not part of the scheduled cron. Run manually against production data:
//   npx tsx scripts/backfill.ts [pagesPerSource]
//
// EU-Startups is excluded: its category/archive pages return 403 live and
// its Wayback Machine snapshots come back empty (204, confirmed
// 2026-07-12) — no way to discover historical article URLs beyond what its
// RSS feed already exposes. Its RSS feed is still scanned normally by the
// regular cron.

import { readFileSync } from "fs";
import { loadInvestorMatcher } from "../src/lib/matchInvestors";
import { excludeAlreadySeen, processArticle, newScanStats } from "../src/lib/pipeline";
import type { Article } from "../src/lib/feeds";

// This runs standalone via tsx, not through `next dev`/`next build`, so it
// doesn't get Next's automatic .env.local loading — load it manually before
// any lazily-initialized client (Supabase, Gemini, Groq) first reads env vars.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(i + 1).trim();
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

const PAGES_PER_SOURCE = Number(process.argv[2]) || 5;

interface DiscoveredLink {
  url: string;
  publishedAt: Date | null;
}

interface ArchiveSource {
  sourceName: string;
  pageUrl: (page: number) => string;
  extractLinks: (html: string) => DiscoveredLink[];
}

const ARCHIVE_SOURCES: ArchiveSource[] = [
  {
    sourceName: "Tech.eu",
    pageUrl: (page) => `https://tech.eu/page/${page}/`,
    extractLinks: (html) =>
      Array.from(html.matchAll(/href="(https:\/\/tech\.eu\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"/g)).map((m) => ({
        url: m[1],
        publishedAt: new Date(`${m[2]}-${m[3]}-${m[4]}T00:00:00Z`),
      })),
  },
  {
    sourceName: "UKTN",
    pageUrl: (page) => `https://www.uktech.news/funding/page/${page}`,
    extractLinks: (html) =>
      Array.from(html.matchAll(/href="(https:\/\/www\.uktech\.news\/[a-z0-9-]+\/[a-z0-9-]+-(\d{4})(\d{2})(\d{2}))"/g)).map((m) => ({
        url: m[1],
        publishedAt: new Date(`${m[2]}-${m[3]}-${m[4]}T00:00:00Z`),
      })),
  },
  {
    sourceName: "TechCrunch",
    pageUrl: (page) => `https://techcrunch.com/category/fundraising/page/${page}/`,
    extractLinks: (html) =>
      Array.from(html.matchAll(/href="(https:\/\/techcrunch\.com\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"/g)).map((m) => ({
        url: m[1],
        publishedAt: new Date(`${m[2]}-${m[3]}-${m[4]}T00:00:00Z`),
      })),
  },
];

async function discoverLinks(): Promise<Map<string, { publishedAt: Date | null; sourceName: string }>> {
  const discovered = new Map<string, { publishedAt: Date | null; sourceName: string }>();

  for (const source of ARCHIVE_SOURCES) {
    console.log(`--- ${source.sourceName} ---`);
    for (let page = 1; page <= PAGES_PER_SOURCE; page++) {
      try {
        const res = await fetch(source.pageUrl(page), { headers: FETCH_HEADERS });
        if (!res.ok) {
          console.log(`  page ${page}: HTTP ${res.status}, stopping this source`);
          break;
        }
        const html = await res.text();
        const links = source.extractLinks(html);
        let newCount = 0;
        for (const link of links) {
          if (!discovered.has(link.url)) {
            discovered.set(link.url, { publishedAt: link.publishedAt, sourceName: source.sourceName });
            newCount++;
          }
        }
        console.log(`  page ${page}: ${links.length} links, ${newCount} new`);
      } catch (err) {
        console.error(`  page ${page} failed:`, err instanceof Error ? err.message : err);
      }
    }
  }

  return discovered;
}

async function main() {
  console.log(`Historical backfill — ${PAGES_PER_SOURCE} pages per source\n`);

  const discovered = await discoverLinks();
  console.log(`\nTotal unique articles discovered: ${discovered.size}`);

  const candidates: Article[] = Array.from(discovered.entries()).map(([url, meta]) => ({
    sourceName: meta.sourceName,
    url,
    title: "",
    publishedAt: meta.publishedAt,
    text: "", // empty — always triggers processArticle's full-page-fetch enrichment
  }));

  const newArticles = await excludeAlreadySeen(candidates);
  console.log(`Not already in seen_articles: ${newArticles.length}\n`);

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
