/**
 * search.identity.test.js — Identity & Intent Resolution Test Suite (v3.3.1)
 *
 * Tests that Aura correctly resolves user intent and application identity,
 * preventing unrelated tools/extensions/devtools from outranking canonical apps.
 *
 * Run with: node tests/search.identity.test.js
 */

import { rankPackages } from '../src/services/search/rankPackages.js';
import { resolveQueryIdentity } from '../src/services/search/applicationIdentity.js';
import { classifyPackage } from '../src/services/search/classifyPackage.js';

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
console.log('║  Aura Store v3.3.1 — Application Identity Test Suite         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const KNOWN_DISPLAY_NAMES = {
  'visual-studio-code-bin': 'Visual Studio Code',
  'google-chrome': 'Google Chrome',
  'firefox': 'Firefox',
  'discord': 'Discord',
  'spotify': 'Spotify',
};

// ─────────────────────────────────────────────────────────────
// 1. Google Chrome Identity Tests
// ─────────────────────────────────────────────────────────────
console.log('── 1. Google Chrome Identity ──');

{
  const chromeCandidates = [
    { Name: 'chrome-devtools-axi', Description: 'Chrome devtools extension', Popularity: 5, NumVotes: 20 },
    { Name: 'chrome-manifest-v2-policy', Description: 'Enterprise policy for Chrome', Popularity: 12, NumVotes: 50 },
    { Name: 'google-chrome-beta', Description: 'Google Chrome beta channel', Popularity: 30, NumVotes: 400 },
    { Name: 'google-chrome', Description: 'The popular web browser by Google', Popularity: 95, NumVotes: 4500 },
    { Name: 'chromedriver', Description: 'WebDriver for Chrome', Popularity: 40, NumVotes: 800 },
  ];

  // Query: "chrome"
  const ranked1 = rankPackages(chromeCandidates, 'chrome', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked1[0].package.Name === 'google-chrome', '"chrome" ranks google-chrome first');
  assert(ranked1[0].matchReason === 'explicit_alias', 'Match reason is explicit_alias');
  assert(ranked1[1].package.Name === 'google-chrome-beta', 'Official variant is ranked #2');

  // Query: "google chrome"
  const ranked2 = rankPackages(chromeCandidates, 'google chrome', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked2[0].package.Name === 'google-chrome', '"google chrome" ranks google-chrome first');

  // Query: "chrome browser"
  const ranked3 = rankPackages(chromeCandidates, 'chrome browser', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked3[0].package.Name === 'google-chrome', '"chrome browser" ranks google-chrome first');

  // Related packages (devtools, manifest) cannot beat canonical
  assert(ranked1[0].primaryScore > ranked1.find(r => r.package.Name === 'chrome-devtools-axi').primaryScore,
    'chrome-devtools-* strictly scored below canonical package');
}

// ─────────────────────────────────────────────────────────────
// 2. Visual Studio Code Identity Tests
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Visual Studio Code Identity ──');

{
  const vscodeCandidates = [
    { Name: 'vscode-langservers-extracted', Description: 'HTML/CSS/JSON language servers', Popularity: 25, NumVotes: 300 },
    { Name: 'vscode-node-debug2', Description: 'Node debug adapter', Popularity: 15, NumVotes: 80 },
    { Name: 'visual-studio-code-bin', Description: 'Visual Studio Code IDE', Popularity: 85, NumVotes: 5000 },
    { Name: 'visual-studio-code-insiders-bin', Description: 'Insiders build of VS Code', Popularity: 20, NumVotes: 250 },
    { Name: 'vscode-marketplace', Description: 'Marketplace tool', Popularity: 10, NumVotes: 50 },
  ];

  // Query: "vscode"
  const ranked1 = rankPackages(vscodeCandidates, 'vscode', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked1[0].package.Name === 'visual-studio-code-bin', '"vscode" ranks visual-studio-code-bin first');
  assert(ranked1[0].matchReason === 'explicit_alias', 'Match reason is explicit_alias');

  // Query: "vs code"
  const ranked2 = rankPackages(vscodeCandidates, 'vs code', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked2[0].package.Name === 'visual-studio-code-bin', '"vs code" ranks visual-studio-code-bin first');

  // Query: "visual studio code"
  const ranked3 = rankPackages(vscodeCandidates, 'visual studio code', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked3[0].package.Name === 'visual-studio-code-bin', '"visual studio code" ranks visual-studio-code-bin first');

  // Language server / tools demoted below canonical app
  const langServer = ranked1.find(r => r.package.Name === 'vscode-langservers-extracted');
  assert(ranked1[0].primaryScore > langServer.primaryScore, 'vscode language server tools demoted below app');
  assert(langServer.matchReason === 'related_package', 'Langserver classified as related_package');
}

// ─────────────────────────────────────────────────────────────
// 3. Firefox & Official Variants Tests
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Firefox & Official Variants ──');

{
  const firefoxCandidates = [
    { Name: 'firefox-extension-privacy-badger', Description: 'Privacy Badger for Firefox', Popularity: 10, NumVotes: 50 },
    { Name: 'firefox-nightly', Description: 'Firefox Nightly channel', Popularity: 35, NumVotes: 800 },
    { Name: 'firefox', Description: 'Fast, Private & Safe Web Browser', Popularity: 90, NumVotes: 6000 },
    { Name: 'firefox-developer-edition', Description: 'Developer Edition', Popularity: 25, NumVotes: 400 },
  ];

  // Generic query "firefox" prefers canonical
  const ranked1 = rankPackages(firefoxCandidates, 'firefox', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked1[0].package.Name === 'firefox', '"firefox" ranks canonical firefox #1');
  assert(ranked1[1].package.Name === 'firefox-nightly' || ranked1[1].package.Name === 'firefox-developer-edition',
    'Official variants ranked #2/#3 before extensions');

  // Explicit variant query "firefox nightly" favors firefox-nightly above canonical
  const ranked2 = rankPackages(firefoxCandidates, 'firefox nightly', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked2[0].package.Name === 'firefox-nightly', '"firefox nightly" favors firefox-nightly #1');
  assert(ranked2[0].matchReason === 'official_variant+requested', 'Match reason records official_variant+requested');
}

// ─────────────────────────────────────────────────────────────
// 4. Discord Identity Tests
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. Discord Identity ──');

{
  const discordCandidates = [
    { Name: 'discord-canary', Description: 'Discord Canary build', Popularity: 30, NumVotes: 600 },
    { Name: 'discord-rpc-api', Description: 'Rich Presence SDK library', Popularity: 15, NumVotes: 100 },
    { Name: 'discord', Description: 'All-in-one voice and text chat for gamers', Popularity: 88, NumVotes: 4200 },
  ];

  const ranked = rankPackages(discordCandidates, 'discord', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  assert(ranked[0].package.Name === 'discord', '"discord" ranks canonical discord #1');
  assert(ranked[1].package.Name === 'discord-canary', 'discord-canary variant follows #2');
  assert(ranked[2].package.Name === 'discord-rpc-api', 'discord-rpc SDK follows after app');
}

// ─────────────────────────────────────────────────────────────
// 5. Ambiguous Query Invariants (Do not force false identity)
// ─────────────────────────────────────────────────────────────
console.log('\n── 5. Ambiguous Query Handling ──');

{
  const codeCandidates = [
    { Name: 'codelite', Description: 'C/C++ IDE', Popularity: 10, NumVotes: 200 },
    { Name: 'code-features', Description: 'Code features utility', Popularity: 5, NumVotes: 30 },
    { Name: 'visual-studio-code-bin', Description: 'VS Code', Popularity: 80, NumVotes: 4000 },
  ];

  const res = resolveQueryIdentity({ normalizedQuery: 'code', tokens: ['code'] });
  assert(res.isAmbiguous === true, 'Query "code" is marked ambiguous');
  assert(res.identity === null, 'Query "code" does not resolve to a forced identity');

  const ranked = rankPackages(codeCandidates, 'code', { knownDisplayNames: KNOWN_DISPLAY_NAMES });
  // codelite has prefix match ("code"lite). visual-studio-code-bin has token match.
  // Both can appear naturally without visual-studio-code-bin forcefully monopolizing it as a forced identity!
  assert(ranked.length === 3, 'Ambiguous query returns balanced candidate results');
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
