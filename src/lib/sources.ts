export interface NewsSource {
  name: string;
  feedUrl: string;
  region: "UK" | "EU";
}

// Verified working RSS feeds, checked 2026-07-11. Sifted's feed returns 403
// (Cloudflare bot-blocking) even with a browser user-agent — not usable for
// automated pulls, so it's excluded despite good sector fit.
export const NEWS_SOURCES: NewsSource[] = [
  { name: "Tech.eu", feedUrl: "https://tech.eu/feed/", region: "EU" },
  { name: "EU-Startups", feedUrl: "https://www.eu-startups.com/feed/", region: "EU" },
  { name: "UKTN", feedUrl: "https://www.uktech.news/feed", region: "UK" },
  { name: "Silicon Canals", feedUrl: "https://siliconcanals.com/feed/", region: "EU" },
];
