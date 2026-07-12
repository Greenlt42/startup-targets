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
// - scalingeurope.co.uk/dispatches: real European funding content, but no RSS feed
//   (client-rendered SPA — /feed returns the homepage shell, not XML). Would need
//   page-scraping to use; skipped to stay RSS-only per architecture decision.
// - fundediq.co/funded-startups-united-kingdom/: real UK funding-tracker page, but
//   no RSS feed (404, no autodiscovery, not in sitemap). Same as above — skipped.
// - idea-london.co.uk: real, working sitewide RSS feed, but mostly evergreen
//   accelerator/advice content with only occasional funding roundups — skipped for
//   low signal-to-noise vs. the sources below.
// - Silicon Canals: dropped 2026-07-12 after building the pipeline — spot-checked
//   the 10 most recent feed items and 9 were unrelated lifestyle/psychology content
//   (not tech/funding at all), just 1 tangentially about startup funding. The site's
//   own tagline ("Technology, Politics, Mind") suggests this isn't a fluke; the feed
//   is too diluted to be worth the AI extraction cost.
//
// Note on EU-Startups: its weekly aggregate "funding round-up" post is paywalled
// (CLUB members only) in the RSS content — extraction will correctly return an
// empty array for it. Not a problem: individual per-company funding articles from
// the same feed are freely readable and are the more useful format anyway.
export const NEWS_SOURCES: NewsSource[] = [
  { name: "Tech.eu", feedUrl: "https://tech.eu/feed/", region: "EU" },
  { name: "EU-Startups", feedUrl: "https://www.eu-startups.com/feed/", region: "EU" },
  { name: "UKTN", feedUrl: "https://www.uktech.news/feed", region: "UK" },
  // Global funding aggregator with structured fields (round, amount, investors,
  // sector, HQ) — not UK/EU-native, so rely on downstream HQ/sector/size filtering
  // to screen out non-matching regions and oversized rounds.
  { name: "ProjectStartups", feedUrl: "https://projectstartups.com/index.xml", region: "Global" },
];
