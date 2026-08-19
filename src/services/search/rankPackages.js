/**
 * rankPackages.js — Deterministic relevance and identity ranking for Aura search.
 *
 * Architecture:
 *   1. Resolve Application Identity & Intent from query (applicationIdentity.js)
 *   2. Classify candidate packages into package family roles (classifyPackage.js)
 *   3. Compute PRIMARY relevance score (Identity > Exact Name > Prefix > Tokens > Description)
 *   4. Compute SECONDARY tie-break signals (popularity, votes)
 *   5. Sort lexicographically: [primaryScore DESC, popularity DESC, votes DESC]
 *
 *   Primary relevance ALWAYS wins over popularity/votes.
 *   Popularity/votes ONLY break ties within the same primary relevance tier.
 *
 * The function is PURE and DETERMINISTIC:
 *   Given the same candidates, query, and context, it ALWAYS produces the same ordering.
 *
 * @module rankPackages
 */

import { normalizeQuery } from './normalizeQuery.js';
import { resolveQueryIdentity } from './applicationIdentity.js';
import { classifyPackage } from './classifyPackage.js';

// Variant suffixes that receive a penalty when the query doesn't explicitly request them
const VARIANT_SUFFIXES = ['-git', '-bin', '-debug', '-nightly', '-beta', '-devel', '-dev', '-svn', '-hg', '-bzr', '-cvs'];

// Variant keywords that, when present in the query, REMOVE the penalty for matching variants
const VARIANT_KEYWORDS = ['git', 'bin', 'debug', 'nightly', 'beta', 'devel', 'dev', 'svn', 'hg', 'bzr', 'cvs', 'insiders', 'canary', 'ptb', 'esr'];

/**
 * Score a single package against a normalized query and resolved identity.
 *
 * @param {object} pkg - AUR package object (Name, Description, NumVotes, Popularity, etc.)
 * @param {{ rawQuery: string, normalizedQuery: string, tokens: string[] }} query
 * @param {object} queryIdentity - Resolved identity from resolveQueryIdentity
 * @param {{ installedPackages: Set<string>, knownDisplayNames: object }} context
 * @returns {{ primaryScore: number, popularity: number, votes: number, matchReason: string }}
 */
function scorePackage(pkg, query, queryIdentity, context) {
  const { normalizedQuery, tokens } = query;
  const { identity, variantTerms } = queryIdentity;
  const pkgName = (pkg.Name || '').toLowerCase();
  const pkgNameNormalized = pkgName.replace(/[-_]/g, ' ');
  const description = (pkg.Description || '').toLowerCase();

  // Classify package family role relative to resolved identity
  const familyRole = classifyPackage(pkg, identity, variantTerms);

  // Look up known display name
  const displayName = context.knownDisplayNames?.[pkgName] || '';
  const displayNameLower = displayName.toLowerCase();
  const displayNameNormalized = displayNameLower.replace(/[-_]/g, ' ');

  let primaryScore = 0;
  let matchReason = 'none';

  // --- TIER 0: Canonical Application Identity & Explicit Aliases (+160–220) ---
  if (identity && !queryIdentity.isAmbiguous) {
    if (familyRole === 'canonical') {
      // Top canonical package for this application (e.g. google-chrome, visual-studio-code-bin)
      primaryScore = 200;
      matchReason = identity.aliases.includes(normalizedQuery) ? 'explicit_alias' : 'exact_canonical_identity';
    } else if (familyRole === 'official_variant') {
      // Check if this variant was explicitly requested in the query (e.g. "firefox nightly")
      const variantRequested = variantTerms.some(vt => pkgName.includes(vt));
      if (variantRequested) {
        primaryScore = 220; // Explicitly requested variant ranks above even the base canonical package!
        matchReason = 'official_variant+requested';
      } else {
        primaryScore = 160;
        matchReason = 'official_variant';
      }
    } else if (familyRole === 'related') {
      // Related tools/extensions/servers for this identity (e.g. vscode-langservers-extracted, chrome-devtools)
      // Placed in lower tier so they never outrank the canonical package or its official variants
      primaryScore = 40;
      matchReason = 'related_package';
    }
  }

  // --- TIER 1: Exact identity & Name matches (+95–120) ---

  // Exact application/display name match
  if (primaryScore < 120 && displayNameNormalized && (displayNameNormalized === normalizedQuery || displayNameLower === normalizedQuery)) {
    primaryScore = Math.max(primaryScore, 120);
    if (matchReason === 'none') matchReason = 'exact_application_name';
  }

  // Exact package name match
  if (primaryScore < 100 && (pkgName === normalizedQuery || pkgName === query.rawQuery.toLowerCase())) {
    primaryScore = Math.max(primaryScore, 100);
    if (matchReason === 'none') matchReason = 'exact_package_name';
  }

  // Exact normalized package name match (e.g. "visual studio code" matches "visual-studio-code-bin")
  if (primaryScore < 95 && pkgNameNormalized === normalizedQuery) {
    primaryScore = Math.max(primaryScore, 95);
    if (matchReason === 'none') matchReason = 'exact_package_name_normalized';
  }

  // --- TIER 2: Strong name matches (+60–80) ---

  // Name starts with query
  if (primaryScore < 80 && (pkgName.startsWith(normalizedQuery) || pkgNameNormalized.startsWith(normalizedQuery))) {
    primaryScore = Math.max(primaryScore, 80);
    if (matchReason === 'none') matchReason = 'prefix_match';
  }

  // Display name starts with query
  if (primaryScore < 78 && displayNameNormalized && displayNameNormalized.startsWith(normalizedQuery)) {
    primaryScore = Math.max(primaryScore, 78);
    if (matchReason === 'none') matchReason = 'prefix_application_name';
  }

  // All query tokens appear in package name (token match)
  if (primaryScore < 60 && tokens.length > 1) {
    const allTokensInName = tokens.every(t => pkgNameNormalized.includes(t));
    if (allTokensInName) {
      primaryScore = Math.max(primaryScore, 60);
      if (matchReason === 'none') matchReason = 'token_match';
    }
  }

  // All query tokens appear in display name
  if (primaryScore < 58 && tokens.length > 1 && displayNameNormalized) {
    const allTokensInDisplay = tokens.every(t => displayNameNormalized.includes(t));
    if (allTokensInDisplay) {
      primaryScore = Math.max(primaryScore, 58);
      if (matchReason === 'none') matchReason = 'token_match_application_name';
    }
  }

  // --- TIER 3: Contains matches (+30–45) ---

  // Name contains query
  if (primaryScore < 45 && (pkgName.includes(normalizedQuery) || pkgNameNormalized.includes(normalizedQuery))) {
    primaryScore = Math.max(primaryScore, 45);
    if (matchReason === 'none') matchReason = 'name_contains';
  }

  // Display name contains query
  if (primaryScore < 43 && displayNameNormalized && displayNameNormalized.includes(normalizedQuery)) {
    primaryScore = Math.max(primaryScore, 43);
    if (matchReason === 'none') matchReason = 'application_name_contains';
  }

  // --- TIER 4: Description matches (+10–25) ---

  // All query tokens in description (strong description match)
  if (primaryScore < 25 && tokens.length > 0) {
    const allTokensInDesc = tokens.every(t => description.includes(t));
    if (allTokensInDesc) {
      primaryScore = Math.max(primaryScore, 25);
      if (matchReason === 'none') matchReason = 'description_token_match';
    }
  }

  // Description contains normalized query
  if (primaryScore < 10 && description.includes(normalizedQuery)) {
    primaryScore = Math.max(primaryScore, 10);
    if (matchReason === 'none') matchReason = 'description_contains';
  }

  // --- CONTEXTUAL MODIFIERS ---

  // Installed boost: +10 (contextual signal, NOT primary)
  if (context.installedPackages?.has(pkg.Name)) {
    primaryScore += 10;
    if (matchReason !== 'none') matchReason += '+installed';
  }

  // --- VARIANT PENALTIES (query-token-aware) ---
  const queryRequestsVariant = VARIANT_KEYWORDS.some(vk => tokens.includes(vk));

  if (!queryRequestsVariant && familyRole !== 'canonical') {
    // Apply small penalty for variant suffixes when the query is generic
    for (const suffix of VARIANT_SUFFIXES) {
      if (pkgName.endsWith(suffix)) {
        const penalty = suffix === '-bin' ? 5 : 15;
        primaryScore -= penalty;
        break;
      }
    }
  } else if (queryRequestsVariant && familyRole !== 'official_variant') {
    // Query explicitly requests a variant — BOOST matching package suffixes
    for (const vk of VARIANT_KEYWORDS) {
      if (tokens.includes(vk) && pkgName.endsWith(`-${vk}`)) {
        primaryScore += 20;
        if (matchReason !== 'none') matchReason += '+variant_match';
        break;
      }
    }
  }

  // --- DESCRIPTION-ONLY PENALTY ---
  // If the only match is in the description with zero name relevance, apply penalty
  if (matchReason.startsWith('description_') && !matchReason.includes('installed')) {
    primaryScore -= 10;
  }

  // --- SECONDARY TIE-BREAK SIGNALS ---
  // Scaled 0–15 for both popularity and votes
  const maxPop = 100;
  const maxVotes = 5000;
  const popularity = Math.min(15, Math.round(((pkg.Popularity || 0) / maxPop) * 15));
  const votes = Math.min(15, Math.round(((pkg.NumVotes || 0) / maxVotes) * 15));

  return { primaryScore, popularity, votes, matchReason };
}

/**
 * Rank a list of AUR packages against a query with application identity awareness.
 *
 * @param {object[]} packages - Array of AUR package objects
 * @param {string} rawQuery - The user's typed query string
 * @param {{ installedPackages?: Set<string>, knownDisplayNames?: object }} context
 * @returns {Array<{ package: object, primaryScore: number, popularity: number, votes: number, matchReason: string }>}
 */
export function rankPackages(packages, rawQuery, context = {}) {
  const query = normalizeQuery(rawQuery);

  if (!query.normalizedQuery || query.normalizedQuery.length < 1) {
    return [];
  }

  // Resolve application identity and intent from query
  const queryIdentity = resolveQueryIdentity(query);

  const scored = packages.map(pkg => {
    const score = scorePackage(pkg, query, queryIdentity, context);
    return { package: pkg, ...score };
  });

  // Sort lexicographically: primaryScore DESC → popularity DESC → votes DESC
  scored.sort((a, b) => {
    if (a.primaryScore !== b.primaryScore) return b.primaryScore - a.primaryScore;
    if (a.popularity !== b.popularity) return b.popularity - a.popularity;
    return b.votes - a.votes;
  });

  return scored;
}
