// One-time fix-up: targets inserted before the `location` field existed in
// extract.ts have location = null. Re-fetches each target's source article,
// re-runs extraction, and updates just the location field on the existing
// row (matched by id) — does not touch any other field, and never inserts a
// new row, so this can't create duplicates or clobber a manually-set status.
//
// Run manually: npx tsx scripts/backfill-location.ts

import { readFileSync } from "fs";
import { fetchFullArticlePage } from "../src/lib/feeds";
import { extractDeals } from "../src/lib/extract";
import { supabase } from "../src/lib/supabase";

// This runs standalone via tsx, not through `next dev`/`next build`, so it
// doesn't get Next's automatic .env.local loading — load it manually before
// any lazily-initialized client (Supabase) first reads env vars (safe here
// since supabase.ts's client is a lazy Proxy — this runs before main() ever
// touches it).
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  const key = line.slice(0, i).trim();
  if (key && !(key in process.env)) process.env[key] = line.slice(i + 1).trim();
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const { data: targets, error } = await supabase
    .from("targets")
    .select("id, company_name, source_url")
    .is("location", null)
    .not("source_url", "is", null);

  if (error) throw error;
  console.log(`${targets?.length ?? 0} targets missing location\n`);

  let updated = 0;
  for (const target of targets ?? []) {
    process.stdout.write(`${target.company_name} (${target.source_url}) ... `);
    try {
      const page = await fetchFullArticlePage(target.source_url as string);
      if (!page) {
        console.log("could not fetch article");
        continue;
      }

      const deals = await extractDeals({ sourceName: "", publishedAt: page.publishedAt, text: page.text });
      const match = deals.find((d) => normalize(d.companyName) === normalize(target.company_name as string)) ?? deals[0];

      if (!match?.location) {
        console.log("no location found in article");
        continue;
      }

      const { error: updateError } = await supabase.from("targets").update({ location: match.location }).eq("id", target.id);
      if (updateError) {
        console.log("update failed:", updateError.message);
        continue;
      }
      console.log(`-> ${match.location}`);
      updated++;
    } catch (err) {
      console.log("error:", err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nUpdated ${updated} targets.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
