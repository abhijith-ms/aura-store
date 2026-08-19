/**
 * search.test.js — Unit Tests for Aura v3.3 Intelligent Search & Best-Match Discovery
 *
 * Tests query normalization, deterministic lexicographical ranking,
 * query-aware variant detection, match reasons, and LRU cache behavior.
 *
 * Run with: node tests/search.test.js
 */

import { normalizeQuery } from '../src/services/search/normalizeQuery.js';
import { rankPackages } from '../src/services/search/rankPackages.js';
import { searchCache } from '../src/services/search/searchCache.js';

let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✕ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Aura Store v3.3 — Intelligent Search Test Suite            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Query Normalization Tests
// ─────────────────────────────────────────────────────────────
console.log('── 1. Query Normalization ──');

{
  const q1 = normalizeQuery('  Visual Studio Code  ');
  assert(q1.rawQuery === 'Visual Studio Code', 'Preserves raw query whitespace trimming');
  assert(q1.normalizedQuery === 'visual studio code', 'Normalizes casing and whitespace');
  assert(JSON.stringify(q1.tokens) === JSON.stringify(['visual', 'studio', 'code']), 'Extracts tokens properly');

  const q2 = normalizeQuery('visual-studio_code');
  assert(q2.normalizedQuery === 'visual studio code', 'Normalizes hyphens and underscores to spaces');

  const q3 = normalizeQuery('');
  assert(q3.normalizedQuery === '', 'Handles empty query string');
  assert(q3.tokens.length === 0, 'Empty query has zero tokens');
}

// ─────────────────────────────────────────────────────────────
// 2. Exact Identity & Lexicographical Ranking Tests
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Ranking & Identity Invariants ──');

const KNOWN_DISPLAY_NAMES = {
  'visual-studio-code-bin': 'Visual Studio Code',
  'spotify': 'Spotify',
  'firefox-nightly': 'Firefox Nightly',
  'paru': 'Paru AUR Helper',
  'discord': 'Discord',
};

{
  // Test 1: Exact package name ranks first
  const candidates = [
    { Name: 'paru-git', Description: 'Development branch of paru', Popularity: 10, NumVotes: 500 },
    { Name: 'paru', Description: 'Feature packed AUR helper', Popularity: 80, NumVotes: 3000 },
    { Name: 'paru-bin', Description: 'Binary build of paru', Popularity: 15, NumVotes: 200 },
  ];

  const ranked = rankPackages(candidates, 'paru', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked[0].package.Name === 'paru', 'Exact package name "paru" ranks #1');
  assert(ranked[0].matchReason === 'exact_package_name', 'Match reason is exact_package_name');
}

{
  // Test 2: Exact application name ranks first
  const candidates = [
    { Name: 'code-marketplace', Description: 'Marketplace for code', Popularity: 90, NumVotes: 4000 },
    { Name: 'visual-studio-code-bin', Description: 'Visual Studio Code binary', Popularity: 50, NumVotes: 2500 },
    { Name: 'code-server', Description: 'VS Code in the browser', Popularity: 70, NumVotes: 1200 },
  ];

  const ranked = rankPackages(candidates, 'visual studio code', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked[0].package.Name === 'visual-studio-code-bin', 'Exact application name "Visual Studio Code" ranks #1');
  assert(ranked[0].matchReason === 'exact_application_name', 'Match reason is exact_application_name');
}

{
  // Test 3: Extreme popularity CANNOT override exact identity
  const candidates = [
    { Name: 'unrelated-super-popular', Description: 'Contains spotify integration plugin', Popularity: 99.9, NumVotes: 50000 },
    { Name: 'spotify', Description: 'Music player and streaming service', Popularity: 1.0, NumVotes: 10 },
  ];

  const ranked = rankPackages(candidates, 'spotify', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked[0].package.Name === 'spotify', 'Exact name "spotify" beats massively popular description match');
  assert(ranked[0].primaryScore > ranked[1].primaryScore, 'Primary score strictly higher for exact match');
}

{
  // Test 4: Prefix match beats description-only match
  const candidates = [
    { Name: 'random-tool', Description: 'A tool for managing discord bots', Popularity: 50, NumVotes: 500 },
    { Name: 'discord-canary', Description: 'Discord Canary preview build', Popularity: 10, NumVotes: 100 },
  ];

  const ranked = rankPackages(candidates, 'discord', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked[0].package.Name === 'discord-canary', 'Prefix match "discord-canary" beats description match');
}

{
  // Test 5: Installed package gets small contextual boost
  const candidates = [
    { Name: 'fastfetch', Description: 'Neofetch-like tool', Popularity: 10, NumVotes: 100 },
    { Name: 'fastfetch-git', Description: 'Git version of fastfetch', Popularity: 10, NumVotes: 100 },
  ];

  const rankedInstalled = rankPackages(candidates, 'fastfetch', {
    installedPackages: new Set(['fastfetch-git']),
    knownDisplayNames: {},
  });
  // fastfetch is exact match (+100 - 0 = 100). fastfetch-git is prefix (+80 - 15 + 10 = 75).
  // Exact match still wins over installed variant!
  assert(rankedInstalled[0].package.Name === 'fastfetch', 'Installed status does not override exact package match');

  // But between two prefix matches, installed one wins
  const prefixCandidates = [
    { Name: 'fastfetch-dev', Description: 'Dev branch', Popularity: 10, NumVotes: 100 },
    { Name: 'fastfetch-next', Description: 'Next branch', Popularity: 10, NumVotes: 100 },
  ];
  const rankedPrefix = rankPackages(prefixCandidates, 'fastfetch', {
    installedPackages: new Set(['fastfetch-next']),
    knownDisplayNames: {},
  });
  assert(rankedPrefix[0].package.Name === 'fastfetch-next', 'Installed boost acts as tie-breaker for equivalent relevance');
  assert(rankedPrefix[0].matchReason.includes('installed'), 'Match reason includes +installed');
}

// ─────────────────────────────────────────────────────────────
// 3. Variant Handling (Query-Token-Aware)
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Query-Aware Variant Detection ──');

{
  // Generic query "firefox" penalizes -git and -nightly variants
  const candidates = [
    { Name: 'firefox-nightly', Description: 'Nightly build', Popularity: 20, NumVotes: 100 },
    { Name: 'firefox-git', Description: 'Git master branch', Popularity: 20, NumVotes: 100 },
    { Name: 'firefox', Description: 'Mainstream browser', Popularity: 20, NumVotes: 100 },
  ];

  const rankedGeneric = rankPackages(candidates, 'firefox', { knownDisplayNames: {} });
  assert(rankedGeneric[0].package.Name === 'firefox', 'Generic query prefers canonical package over variants');

  // Explicit query "firefox nightly" favors firefox-nightly
  const rankedNightly = rankPackages(candidates, 'firefox nightly', { knownDisplayNames: {} });
  assert(rankedNightly[0].package.Name === 'firefox-nightly', 'Explicit variant query "firefox nightly" favors -nightly package');
  assert(rankedNightly[0].matchReason.includes('variant_match'), 'Match reason records +variant_match');

  // Explicit query "firefox git" favors firefox-git
  const rankedGit = rankPackages(candidates, 'firefox git', { knownDisplayNames: {} });
  assert(rankedGit[0].package.Name === 'firefox-git', 'Explicit variant query "firefox git" favors -git package');
}

// ─────────────────────────────────────────────────────────────
// 4. LRU Cache Tests
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. Search LRU Cache ──');

{
  searchCache.clear();
  assert(searchCache.size === 0, 'Cache is empty after clear()');

  searchCache.set('spotify', [{ Name: 'spotify' }]);
  assert(searchCache.has('spotify'), 'Cache stores item');
  assert(searchCache.get('spotify')?.[0]?.Name === 'spotify', 'Cache retrieves item');

  // Cache miss
  assert(searchCache.get('nonexistent_key') === null, 'Cache miss returns null');

  // Test LRU eviction when capacity reached
  searchCache.clear();
  for (let i = 0; i < 105; i++) {
    searchCache.set(`key_${i}`, [{ Name: `pkg_${i}` }]);
  }
  assert(searchCache.size === 100, 'Cache caps size at max entries (100)');
  assert(!searchCache.has('key_0'), 'Oldest LRU entry (key_0) evicted');
  assert(searchCache.has('key_104'), 'Newest entry (key_104) is present');
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
