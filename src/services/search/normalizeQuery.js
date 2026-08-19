/**
 * normalizeQuery.js — Query normalization for Aura search ranking.
 *
 * Returns both the raw query (for display) and a normalized form (for ranking),
 * plus extracted tokens for variant-aware matching.
 *
 * Rules:
 *   - lowercase, trim, collapse whitespace
 *   - hyphens → spaces, underscores → spaces (for normalized form)
 *   - Preserves original raw query exactly as typed
 */

/**
 * @param {string} rawInput - The user's typed query string
 * @returns {{ rawQuery: string, normalizedQuery: string, tokens: string[] }}
 */
export function normalizeQuery(rawInput) {
  const rawQuery = (rawInput || '').trim();

  const normalizedQuery = rawQuery
    .toLowerCase()
    .replace(/[-_]/g, ' ')     // hyphens and underscores → spaces
    .replace(/\s+/g, ' ')      // collapse repeated whitespace
    .trim();

  const tokens = normalizedQuery.split(' ').filter(Boolean);

  return { rawQuery, normalizedQuery, tokens };
}
