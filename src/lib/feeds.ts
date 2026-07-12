import Parser from "rss-parser";
import { NEWS_SOURCES } from "./sources";

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
