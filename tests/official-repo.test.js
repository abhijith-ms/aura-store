/**
 * official-repo.test.js — Unit & Live Tests for v5.0 Official Arch Repo Search
 *
 * Verifies `pacman -Ss`/`pacman -Si` output parsing (fixture-based, deterministic)
 * plus a live smoke test against the actual API endpoints.
 *
 * Run with: node tests/official-repo.test.js
 */

import { parseSearchOutput, parseInfoOutput } from '../server/officialRepo.js';

const API = 'http://localhost:3001';

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
console.log('║  Aura Store v5.0 — Official Arch Repo Search Test Suite      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. `pacman -Ss` Search Output Parsing
// ─────────────────────────────────────────────────────────────
console.log('── 1. Search Output Parsing ──');

const searchFixture = [
  'extra/firefox 153.0.4-1 [installed: 153.0.4-1.1]',
  '    Fast, Private & Safe Web Browser',
  'cachyos/firefox-esr-bin 153.0-2',
  '    Standalone web browser from mozilla.org - Extended Support Release',
  'extra/htop 3.3.0-1 [installed]',
  '    Interactive process viewer',
].join('\n');

const searchResults = parseSearchOutput(searchFixture);
assert(searchResults.length === 3, 'Parses 3 packages from fixture', `got ${searchResults.length}`);
assert(searchResults[0].Name === 'firefox', 'First package name is firefox');
assert(searchResults[0].Repository === 'extra', 'First package repository is extra');
assert(searchResults[0].Version === '153.0.4-1', 'First package version excludes installed suffix');
assert(searchResults[0].Installed === true, 'Detects installed with explicit differing version');
assert(searchResults[0].InstalledVersion === '153.0.4-1.1', 'Captures explicit installed version');
assert(searchResults[0].Source === 'official', 'Tags Source as official');
assert(searchResults[0].Description === 'Fast, Private & Safe Web Browser', 'Captures description from next line');
assert(searchResults[1].Repository === 'cachyos', 'Handles distro-added repo (cachyos)');
assert(searchResults[1].Installed === false, 'Not-installed package has Installed: false');
assert(searchResults[2].Installed === true && searchResults[2].InstalledVersion === '3.3.0-1', 'Bare [installed] falls back to sync version');
assert(parseSearchOutput('').length === 0, 'Empty stdout yields no results');
assert(parseSearchOutput('garbage\nnot a package line').length === 0, 'Unparseable lines are skipped, not thrown');

// ─────────────────────────────────────────────────────────────
// 2. `pacman -Si` Info Output Parsing
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Info Output Parsing ──');

const infoFixture = [
  'Repository      : core',
  'Name            : glibc',
  'Version         : 2.44-1',
  'Description     : GNU C Library',
  'Architecture    : x86_64',
  'URL             : https://www.gnu.org/software/libc',
  'Licenses        : GPL-2.0-or-later  LGPL-2.1-or-later',
  'Groups          : None',
  'Provides        : None',
  'Depends On      : linux-api-headers>=4.10  tzdata  filesystem',
  'Optional Deps   : gd: for memusagestat',
  '                  perl: for mtrace',
  'Conflicts With  : None',
  'Replaces        : None',
  'Packager        : Frederik Schwan <freswa@archlinux.org>',
  '',
].join('\n');

const info = parseInfoOutput(infoFixture);
assert(info.Name === 'glibc', 'Parses package name');
assert(info.Repository === 'core', 'Parses repository');
assert(info.Version === '2.44-1', 'Parses version');
assert(info.URL === 'https://www.gnu.org/software/libc', 'Parses URL');
assert(info.Source === 'official', 'Tags Source as official');
assert(JSON.stringify(info.License) === JSON.stringify(['GPL-2.0-or-later', 'LGPL-2.1-or-later']), 'Splits multi-value Licenses field');
assert(JSON.stringify(info.Depends) === JSON.stringify(['linux-api-headers>=4.10', 'tzdata', 'filesystem']), 'Splits Depends On field');
assert(info.OptDepends.length === 2 && info.OptDepends[0] === 'gd: for memusagestat', 'Joins wrapped Optional Deps continuation lines');
assert(info.Maintainer === 'Frederik Schwan <freswa@archlinux.org>', 'Maps Packager to Maintainer');
assert(parseInfoOutput('') === null, 'Empty stdout returns null instead of throwing');

const noneFixture = 'Name            : pkgname\nDepends On      : None\nOptional Deps   : None\nLicenses        : None\n';
const noneInfo = parseInfoOutput(noneFixture);
assert(Array.isArray(noneInfo.Depends) && noneInfo.Depends.length === 0, '"None" Depends On yields empty array');
assert(Array.isArray(noneInfo.OptDepends) && noneInfo.OptDepends.length === 0, '"None" Optional Deps yields empty array');
assert(Array.isArray(noneInfo.License) && noneInfo.License.length === 0, '"None" Licenses yields empty array');

// ─────────────────────────────────────────────────────────────
// 3. Live API Endpoints
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Live API Endpoints ──');

async function testLiveEndpoints() {
  try {
    const searchRes = await fetch(`${API}/api/search/official?q=glibc`);
    assert(searchRes.status === 200, 'GET /api/search/official returns 200');
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.results), 'Search response has results array');
    assert(searchData.results.every(r => r.Source === 'official'), 'All search results tagged Source: official');

    const emptyRes = await fetch(`${API}/api/search/official?q=`);
    const emptyData = await emptyRes.json();
    assert(Array.isArray(emptyData.results) && emptyData.results.length === 0, 'Empty query returns empty results, not an error');

    const infoRes = await fetch(`${API}/api/info/official?pkg=glibc`);
    assert(infoRes.status === 200, 'GET /api/info/official returns 200');
    const infoData = await infoRes.json();
    assert(infoData.results?.[0]?.Name === 'glibc', 'Info endpoint returns glibc details');
    assert(Array.isArray(infoData.results[0].Depends), 'Info result has parsed Depends array');

    const missingRes = await fetch(`${API}/api/info/official?pkg=this-package-does-not-exist-xyz`);
    const missingData = await missingRes.json();
    assert(Array.isArray(missingData.results) && missingData.results.length === 0, 'Nonexistent package returns empty results, not a crash');
  } catch (err) {
    console.log('  ⓘ Backend not running on :3001:', err.message);
  }
}

async function main() {
  await testLiveEndpoints();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
