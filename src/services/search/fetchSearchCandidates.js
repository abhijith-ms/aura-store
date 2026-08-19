/**
 * fetchSearchCandidates.js — Smart candidate retrieval for Aura search.
 *
 * Solves AUR's strict literal-substring RPC limitation:
 *   - Runs candidate search for user query + clean identity terms
 *   - Ensures canonical packages for resolved application identities are present
 *   - Combines and deduplicates candidate pool before ranking
 */

import { searchPackages, getMultiplePackageInfo } from '../aurApi.js';
import { normalizeQuery } from './normalizeQuery.js';
import { resolveQueryIdentity } from './applicationIdentity.js';

/**
 * Fetch candidate packages for a search query.
 *
 * @param {string} rawQuery - The user's typed search query
 * @param {string} sortBy - Sort order
 * @returns {Promise<object[]>} Array of unique AUR package candidate objects
 */
export async function fetchSearchCandidates(rawQuery, sortBy = 'name-desc') {
  const norm = normalizeQuery(rawQuery);
  const identityRes = resolveQueryIdentity(norm);

  const queriesToRun = new Set([rawQuery.trim()]);

  // 1. If clean identity query exists (e.g. "chrome" from "chrome browser" or "vscode" from "vs code")
  if (identityRes.cleanIdentityQuery && identityRes.cleanIdentityQuery.length >= 2) {
    queriesToRun.add(identityRes.cleanIdentityQuery);
  }

  // 2. If identity was resolved, add primary alias terms for candidate retrieval
  if (identityRes.identity) {
    for (const alias of identityRes.identity.aliases.slice(0, 3)) {
      if (alias.length >= 2 && !alias.includes(' ')) {
        queriesToRun.add(alias);
      }
    }
  }

  // Fetch candidates in parallel
  const fetches = [...queriesToRun].map(q => searchPackages(q, sortBy).catch(() => []));
  const results = await Promise.all(fetches);

  // Combine and deduplicate by package Name
  const candidateMap = new Map();
  for (const list of results) {
    for (const pkg of list) {
      if (pkg?.Name && !candidateMap.has(pkg.Name)) {
        candidateMap.set(pkg.Name, pkg);
      }
    }
  }

  // 3. Ensure canonical packages for resolved identity are in candidate pool
  if (identityRes.identity?.canonicalPackages) {
    const missingCanonical = identityRes.identity.canonicalPackages.filter(p => !candidateMap.has(p));
    if (missingCanonical.length > 0) {
      const canonicalInfos = await getMultiplePackageInfo(missingCanonical).catch(() => []);
      for (const pkg of canonicalInfos) {
        if (pkg?.Name && !candidateMap.has(pkg.Name)) {
          candidateMap.set(pkg.Name, pkg);
        }
      }
    }
  }

  return [...candidateMap.values()];
}
