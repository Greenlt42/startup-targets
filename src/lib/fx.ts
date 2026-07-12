// Static approximate FX rates to USD. Good enough for a $50M threshold check —
// not exact, but close calls near the cutoff are rare enough not to justify a
// live FX API dependency. Update periodically if rates drift significantly.
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  CHF: 1.13,
  SEK: 0.096,
  DKK: 0.145,
  NOK: 0.094,
  PLN: 0.25,
};

// `amountInMillions` matches extract.ts's convention (the AI returns 5 for
// "$5M", not 5000000). Returns the actual dollar amount, not millions — e.g.
// convertToUsd(5, "USD") === 5_000_000 — so it's directly comparable against
// a real-dollar threshold like MAX_ROUND_SIZE_USD in the scan route.
//
// Returns null for unrecognized currencies rather than guessing — callers
// should treat null as "can't verify the round-size cap" and exclude the
// deal, so an unrecognized currency never lets an oversized round slip through.
export function convertToUsd(amountInMillions: number, currency: string): number | null {
  const rate = USD_RATES[currency.toUpperCase()];
  if (rate == null) return null;
  return amountInMillions * rate * 1_000_000;
}
