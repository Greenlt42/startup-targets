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

// Returns null for unrecognized currencies rather than guessing — callers
// should treat null as "can't verify the round-size cap" and exclude the
// deal, so an unrecognized currency never lets an oversized round slip through.
export function convertToUsd(amount: number, currency: string): number | null {
  const rate = USD_RATES[currency.toUpperCase()];
  if (rate == null) return null;
  return amount * rate;
}
