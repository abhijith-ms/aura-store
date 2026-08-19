/**
 * applicationIdentity.js — Application identity and intent resolution.
 *
 * Distinguishes identity terms from context terms and variant terms.
 * Resolves specific queries into canonical application identities.
 * Ensures ambiguous queries ("code", "browser", "editor") remain broad.
 */

import { APPLICATION_IDENTITIES } from './applicationAliases.js';

export const CONTEXT_TERMS = new Set([
  'browser',
  'web',
  'app',
  'application',
  'client',
  'desktop',
  'launcher',
  'editor',
  'player',
  'manager',
  'tool',
  'tools',
  'utility',
  'utilities',
  'gui',
  'cli',
  'software',
]);

export const VARIANT_TERMS = new Set([
  'nightly',
  'beta',
  'git',
  'dev',
  'devel',
  'insiders',
  'esr',
  'canary',
  'preview',
  'stable',
  'bin',
  'ptb',
  'native',
]);

// Purely ambiguous / generic single terms that must not force a single application
const AMBIGUOUS_TERMS = new Set([
  'code',
  'browser',
  'editor',
  'player',
  'music',
  'video',
  'game',
  'terminal',
  'tool',
  'utility',
  'desktop',
  'app',
]);

/**
 * Resolve query terms and application identity.
 *
 * @param {{ rawQuery: string, normalizedQuery: string, tokens: string[] }} query
 * @returns {{
 *   identity: object|null,
 *   isAmbiguous: boolean,
 *   identityTerms: string[],
 *   variantTerms: string[],
 *   contextTerms: string[],
 *   cleanIdentityQuery: string
 * }}
 */
export function resolveQueryIdentity(query) {
  const { normalizedQuery, tokens } = query;

  if (!normalizedQuery) {
    return {
      identity: null,
      isAmbiguous: true,
      identityTerms: [],
      variantTerms: [],
      contextTerms: [],
      cleanIdentityQuery: '',
    };
  }

  const identityTerms = [];
  const variantTerms = [];
  const contextTerms = [];

  for (const token of tokens) {
    if (VARIANT_TERMS.has(token)) {
      variantTerms.push(token);
    } else if (CONTEXT_TERMS.has(token)) {
      contextTerms.push(token);
    } else {
      identityTerms.push(token);
    }
  }

  const cleanIdentityQuery = identityTerms.join(' ');

  // Guard against purely ambiguous queries (e.g. "code", "browser", "editor")
  if (tokens.length === 1 && AMBIGUOUS_TERMS.has(tokens[0])) {
    return {
      identity: null,
      isAmbiguous: true,
      identityTerms,
      variantTerms,
      contextTerms,
      cleanIdentityQuery,
    };
  }

  // Look for exact match in alias registry
  for (const identity of APPLICATION_IDENTITIES) {
    // 1. Direct match on full normalized query
    if (identity.aliases.includes(normalizedQuery)) {
      return {
        identity,
        isAmbiguous: false,
        identityTerms,
        variantTerms,
        contextTerms,
        cleanIdentityQuery,
      };
    }

    // 2. Match on stripped identity query (e.g. "chrome browser" -> "chrome" -> Google Chrome)
    if (cleanIdentityQuery && identity.aliases.includes(cleanIdentityQuery)) {
      return {
        identity,
        isAmbiguous: false,
        identityTerms,
        variantTerms,
        contextTerms,
        cleanIdentityQuery,
      };
    }
  }

  return {
    identity: null,
    isAmbiguous: false,
    identityTerms,
    variantTerms,
    contextTerms,
    cleanIdentityQuery,
  };
}
