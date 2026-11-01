import type { FundamentalDrill } from '../types';

/** First win per lowercased trimmed name — Excel rows and re-imports often repeat titles. */
export function uniqueDrillsByName(drills: FundamentalDrill[]): FundamentalDrill[] {
  const seen = new Set<string>();
  const out: FundamentalDrill[] = [];
  for (const d of drills) {
    const key = d.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
