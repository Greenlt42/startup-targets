import { supabase } from "./supabase";

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface InvestorMatcher {
  match(extractedNames: string[]): string | null; // returns the matched canonical DB name, or null
}

// Loads the investors table once per scan run and does simple normalized
// exact/substring matching against extracted investor names. This is
// approximate (no fuzzy/edit-distance matching) — good enough for a ~70-row
// allowlist where firm names are fairly distinctive, but revisit if false
// positives/negatives show up in practice.
export async function loadInvestorMatcher(): Promise<InvestorMatcher> {
  const { data, error } = await supabase.from("investors").select("name");
  if (error) throw error;

  const known = (data ?? []).map((row) => ({ canonical: row.name as string, normalized: normalize(row.name as string) }));

  return {
    match(extractedNames: string[]): string | null {
      for (const extracted of extractedNames) {
        const norm = normalize(extracted);
        if (!norm) continue;
        for (const entry of known) {
          if (norm === entry.normalized || norm.includes(entry.normalized) || entry.normalized.includes(norm)) {
            return entry.canonical;
          }
        }
      }
      return null;
    },
  };
}
