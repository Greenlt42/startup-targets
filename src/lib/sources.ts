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
// - fundediq.co/funded-startups-united-kingdom/: real UK funding-tracker page, but
//   no RSS feed (404, no autodiscovery, not in sitemap), and no server-rendered
//   listing HTML either — nothing to build a listing source from.
// - idea-london.co.uk: real, working sitewide RSS feed, but mostly evergreen
//   accelerator/advice content with only occasional funding roundups — skipped for
//   low signal-to-noise vs. the sources below.
// - funding.tech.eu/rounds: a separate, gated product from the main tech.eu blog
//   (which we already cover) — every path returns 429 behind a Vercel security
//   checkpoint, no way to access it without solving a bot challenge.
//
// scalingeurope.co.uk/dispatches was previously rejected as "no RSS feed, would
// need page-scraping" — revisited 2026-07-14: its listing page turns out to embed
// real article links server-side (no JS needed to discover them, just no RSS/XML
// format), and individual article pages carry a JSON-LD publish date. See
// LISTING_SOURCES below — same full-page-fetch machinery as the RSS sources'
// thin-content fallback, just the initial link discovery is HTML instead of XML.
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
//
// Note on TechCrunch: its category feed only gives a ~100-char teaser per item
// (no content:encoded), too thin for reliable extraction — feeds.ts fetches the
// full article page as a fallback whenever RSS content is under ~400 chars.
// Feed depth checked 2026-07-12: 20 items over ~15 days, much lower churn than
// EU-Startups, so the 2-hourly cron comfortably covers it without tightening
// further.
export const NEWS_SOURCES: NewsSource[] = [
  { name: "Tech.eu", feedUrl: "https://tech.eu/feed/", region: "EU" },
  { name: "EU-Startups", feedUrl: "https://www.eu-startups.com/feed/", region: "EU" },
  { name: "UKTN", feedUrl: "https://www.uktech.news/feed", region: "UK" },
  // Global funding aggregator with structured fields (round, amount, investors,
  // sector, HQ) — not UK/EU-native, so rely on downstream HQ/sector/size filtering
  // to screen out non-matching regions and oversized rounds.
  { name: "ProjectStartups", feedUrl: "https://projectstartups.com/index.xml", region: "Global" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/category/fundraising/feed/", region: "Global" },
  // Balderton's own portfolio-announcement blog. High-precision: Balderton is
  // already on the investors allowlist, so a "raises $X" post here almost
  // always passes the investor-match filter automatically. Low volume (15
  // items span ~4.5 months as of 2026-07-14) — no scroll-out risk at all with
  // the 2-hourly cron. Worth checking other allowlisted VCs' own blogs for the
  // same pattern (tried Index Ventures, Atomico, Seedcamp, Octopus Ventures,
  // Molten Ventures 2026-07-14 — all blocked or no feed at the paths tried;
  // Balderton was the only hit so far).
  { name: "Balderton Capital", feedUrl: "https://www.balderton.com/feed/", region: "UK" },
];

export interface ListingSource {
  name: string;
  listingUrl: string;
  linkPattern: RegExp;
  region: "UK" | "EU" | "Global";
}

// Sources with no RSS feed at all — link discovery happens by regex-matching
// article URLs out of a listing page's raw HTML instead of parsing XML. See
// fetchAllListingSourceArticles() in feeds.ts.
export const LISTING_SOURCES: ListingSource[] = [
  {
    name: "Scaling Europe",
    listingUrl: "https://scalingeurope.co.uk/dispatches",
    linkPattern: /https:\/\/scalingeurope\.co\.uk\/dispatches\/[a-zA-Z0-9_-]+/g,
    region: "EU",
  },
];
