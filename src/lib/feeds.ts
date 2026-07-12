import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { NEWS_SOURCES } from "./sources";

const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" };

// Common WordPress/news-site main-content container selectors, tried in
// order. Some sources (e.g. TechCrunch) only publish a one-line teaser via
// RSS with no content:encoded — this fetches the full article page as a
// fallback so extraction has enough text to work with. Returns null if the
// page can't be fetched (bot-blocked, 404, etc.) or no selector matches;
// callers should fall back to the RSS-derived text in that case.
const CONTENT_SELECTORS = ["article", ".entry-content", ".post-content", ".article-content", ".article-body", "main"];

export async function fetchFullArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, .ad, .advertisement").remove();

    for (const selector of CONTENT_SELECTORS) {
      const el = $(selector).first();
      const text = el.text().replace(/\s+/g, " ").trim();
      if (text.length > 200) return text;
    }
    return null;
  } catch (err) {
    console.error(`Failed to fetch full article text for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

type FeedItem = {
  "content:encoded"?: string;
};

const parser: Parser<object, FeedItem> = new Parser({
  customFields: { item: ["content:encoded"] },
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; StartupTargetsBot/1.0)" },
});

export interface Article {
  sourceName: string;
  url: string;
  title: string;
  publishedAt: Date | null;
  text: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetches every configured RSS feed and returns normalized articles. A
// failure on one feed is logged and skipped rather than failing the run.
export async function fetchAllArticles(): Promise<Article[]> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.feedUrl);
      return (feed.items ?? []).map((item): Article | null => {
        if (!item.link || !item.title) return null;
        const rawBody = item["content:encoded"] ?? item.content ?? item.contentSnippet ?? "";
        return {
          sourceName: source.name,
          url: item.link,
          title: item.title,
          publishedAt: item.pubDate ? new Date(item.pubDate) : null,
          text: stripHtml(`${item.title}\n\n${rawBody}`),
        };
      }).filter((a): a is Article => a !== null);
    })
  );

  const articles: Article[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      console.error(`Failed to fetch feed ${NEWS_SOURCES[i].name}:`, result.reason);
    }
  });
  return articles;
}
