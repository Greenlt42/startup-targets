export interface NewsSource {
  name: string;
  feedUrl: string;
  region: "UK" | "EU" | "Global";
}

// Verified working RSS feeds, checked 2026-07-11/12. Rejected candidates:
// - Sifted: feed returns 403 (Cloudflare bot-blocking), even with a browser user-agent.
// - fundediq.com: not a news site — a prop-trading "funded account" platform.
// - idealondon.co.uk: not a news site — UCL Engineering's Shoreditch coworking space.
// - scalingeurope.com: appears to be a parked domain (ad-redirect script, no real content).
export const NEWS_SOURCES: NewsSource[] = [
  { name: "Tech.eu", feedUrl: "https://tech.eu/feed/", region: "EU" },
  { name: "EU-Startups", feedUrl: "https://www.eu-startups.com/feed/", region: "EU" },
  { name: "UKTN", feedUrl: "https://www.uktech.news/feed", region: "UK" },
  { name: "Silicon Canals", feedUrl: "https://siliconcanals.com/feed/", region: "EU" },
  // Global funding aggregator with structured fields (round, amount, investors,
  // sector, HQ) — not UK/EU-native, so rely on downstream HQ/sector/size filtering
  // to screen out non-matching regions and oversized rounds.
  { name: "ProjectStartups", feedUrl: "https://projectstartups.com/index.xml", region: "Global" },
];
