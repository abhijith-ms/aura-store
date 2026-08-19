/**
 * search.benchmark.js — Real-World Search Regression Corpus & Live Benchmark (v3.3.2)
 *
 * Runs the standard search query matrix against live AUR candidates and the
 * v3.3.1 application identity + deterministic ranking engine.
 *
 * Usage: node tests/search.benchmark.js
 */

import { rankPackages } from '../src/services/search/rankPackages.js';
import { fetchSearchCandidates } from '../src/services/search/fetchSearchCandidates.js';
import { KNOWN_DISPLAY_NAMES, getAppDisplayName } from '../src/services/aurApi.js';

const API = 'http://localhost:3001';

// The canonical search evaluation matrix
const BENCHMARK_MATRIX = [
  // 1. Google Chrome queries
  {
    query: 'chrome',
    expectedTop: 'google-chrome',
    type: 'identity',
    description: 'Shorthand for Google Chrome',
  },
  {
    query: 'google chrome',
    expectedTop: 'google-chrome',
    type: 'identity',
    description: 'Full official name',
  },
  {
    query: 'chrome browser',
    expectedTop: 'google-chrome',
    type: 'identity_with_context',
    description: 'Identity with category context word',
  },

  // 2. VS Code queries
  {
    query: 'vscode',
    expectedTop: 'visual-studio-code-bin',
    type: 'identity',
    description: 'Common acronym alias',
  },
  {
    query: 'vs code',
    expectedTop: 'visual-studio-code-bin',
    type: 'identity',
    description: 'Spaced acronym alias',
  },
  {
    query: 'visual studio code',
    expectedTop: 'visual-studio-code-bin',
    type: 'identity',
    description: 'Full official name',
  },

  // 3. Firefox queries
  {
    query: 'firefox',
    expectedTop: ['firefox', 'firefox-esr', 'firefox-developer-edition'],
    type: 'identity',
    description: 'Canonical application / official AUR variant',
  },
  {
    query: 'firefox browser',
    expectedTop: ['firefox', 'firefox-esr', 'firefox-developer-edition'],
    type: 'identity_with_context',
    description: 'Identity with category context word',
  },
  {
    query: 'firefox nightly',
    expectedTop: 'firefox-nightly',
    type: 'variant',
    description: 'Explicit variant query',
  },

  // 4. Discord & Spotify
  {
    query: 'discord',
    expectedTop: ['discord', 'discord-canary', 'discord-ptb'],
    type: 'identity',
    description: 'Canonical voice/chat app / official AUR variant',
  },
  {
    query: 'spotify',
    expectedTop: 'spotify',
    type: 'identity',
    description: 'Canonical music streaming app',
  },

  // 5. AUR Helpers
  {
    query: 'paru',
    expectedTop: 'paru',
    type: 'identity',
    description: 'Canonical AUR helper',
  },
  {
    query: 'yay',
    expectedTop: 'yay',
    type: 'identity',
    description: 'Canonical AUR helper',
  },

  // 6. Broad / Ambiguous / Category queries (should remain balanced, not forced)
  {
    query: 'code',
    expectedTop: null, // Any valid code tool/editor, should not force single app
    type: 'broad',
    description: 'Ambiguous broad term',
  },
  {
    query: 'browser',
    expectedTop: null, // Any browser, should remain broad
    type: 'broad',
    description: 'Category broad term',
  },
  {
    query: 'music player',
    expectedTop: null, // Any music player
    type: 'broad',
    description: 'Natural language category query',
  },
  {
    query: 'video editor',
    expectedTop: null, // Any video editor
    type: 'broad',
    description: 'Natural language category query',
  },
  {
    query: 'terminal',
    expectedTop: null, // Any terminal emulator
    type: 'broad',
    description: 'Category broad term',
  },
];

async function fetchCandidates(q) {
  try {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&by=name-desc`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Fetch failed for query "${q}":`, err.message);
    return [];
  }
}

async function runBenchmark() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Aura Store v3.3.2 — Real-World Search Regression Corpus & Live Benchmark              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let total = BENCHMARK_MATRIX.length;
  const benchmarkResults = [];

  for (const item of BENCHMARK_MATRIX) {
    const startTime = performance.now();
    const candidates = await fetchSearchCandidates(item.query);
    const fetchTime = performance.now() - startTime;

    const rankStartTime = performance.now();
    const ranked = rankPackages(candidates, item.query, {
      installedPackages: new Set(),
      knownDisplayNames: KNOWN_DISPLAY_NAMES,
    });
    const rankTime = performance.now() - rankStartTime;

    const top1 = ranked[0] || null;
    const top2 = ranked[1] || null;
    const top3 = ranked[2] || null;

    const actualTopPkg = top1?.package?.Name || 'none';
    const topDisplayName = top1 ? getAppDisplayName(actualTopPkg) : 'none';
    const matchReason = top1?.matchReason || 'none';
    const top3List = [top1, top2, top3].filter(Boolean).map(r => r.package.Name).join(', ');

    let isSuccess = false;

    if (item.type === 'broad') {
      // For broad queries, success means we returned candidates and did not force an invalid exact_canonical_identity
      isSuccess = ranked.length > 0 && matchReason !== 'exact_canonical_identity' && matchReason !== 'explicit_alias';
    } else if (Array.isArray(item.expectedTop)) {
      isSuccess = item.expectedTop.includes(actualTopPkg);
    } else {
      isSuccess = actualTopPkg === item.expectedTop;
    }

    if (isSuccess) passed++;

    const expectedDisplay = Array.isArray(item.expectedTop)
      ? item.expectedTop.join(' / ')
      : (item.expectedTop || '(broad results)');

    benchmarkResults.push({
      query: item.query,
      expected: expectedDisplay,
      actual: actualTopPkg,
      displayName: topDisplayName,
      matchReason,
      top3: top3List,
      status: isSuccess ? 'PASS' : 'FAIL',
      fetchTime: `${fetchTime.toFixed(0)}ms`,
      rankTime: `${rankTime.toFixed(1)}ms`,
      candidatesCount: candidates.length,
    });
  }

  // Print Formatted Report Table
  console.log('┌──────────────────────┬─────────────────────────────┬─────────────────────────────┬───────────────────────────┬────────┐');
  console.log('│ Query                │ Expected Top Package        │ Actual Top Package          │ Match Reason              │ Status │');
  console.log('├──────────────────────┼─────────────────────────────┼─────────────────────────────┼───────────────────────────┼────────┤');

  for (const r of benchmarkResults) {
    const q = r.query.padEnd(20);
    const exp = r.expected.padEnd(27);
    const act = r.actual.padEnd(27);
    const reason = r.matchReason.padEnd(25);
    const status = r.status === 'PASS' ? '✓ PASS' : '✕ FAIL';
    console.log(`│ ${q} │ ${exp} │ ${act} │ ${reason} │ ${status} │`);
  }
  console.log('└──────────────────────┴─────────────────────────────┴─────────────────────────────┴───────────────────────────┴────────┘\n');

  // Print Top 3 Details
  console.log('── Top 3 Results per Query ──\n');
  for (const r of benchmarkResults) {
    console.log(`• "${r.query}" (${r.fetchTime} fetch, ${r.rankTime} rank, ${r.candidatesCount} candidates):`);
    console.log(`  Top 3: [ ${r.top3} ]`);
    console.log(`  Top match: ${r.displayName} (${r.actual}) → reason: ${r.matchReason}\n`);
  }

  console.log('════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`  Benchmark Results: ${passed} passed, ${total - passed} failed, ${total} total (${((passed / total) * 100).toFixed(1)}% accuracy)`);
  console.log('════════════════════════════════════════════════════════════════════════════════════════');

  process.exit(passed === total ? 0 : 1);
}

runBenchmark();
