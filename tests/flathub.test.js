/**
 * flathub.test.js — Unit & Live Tests for v5.0 Flathub Search & Install
 *
 * Verifies the pure command-builder (safe to test without touching
 * flatpak/pkexec — system-scope installs require real polkit authentication,
 * which can't be exercised in an automated test), install-scope detection,
 * and live search/info endpoint shape checks.
 *
 * Run with: node tests/flathub.test.js
 */

import { buildFlathubCommand, getFlathubInstallScope } from '../server/flathub.js';

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
console.log('║  Aura Store v5.0 — Flathub Search & Install Test Suite       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Install Command Builder (pure — no flatpak/pkexec invoked)
// ─────────────────────────────────────────────────────────────
console.log('── 1. Install Command Builder ──');

const userInstall = buildFlathubCommand('install', 'user', 'org.mozilla.firefox');
assert(userInstall.cmd === 'flatpak', 'User-scope install runs flatpak directly (no pkexec)');
assert(userInstall.args.includes('--user'), 'User-scope install passes --user');
assert(userInstall.args.includes('org.mozilla.firefox'), 'Install args include the AppId');
assert(userInstall.args.includes('flathub'), 'Install args include the flathub remote name');
assert(userInstall.args.includes('--noninteractive'), 'Install uses --noninteractive (clean, parseable output)');

const systemInstall = buildFlathubCommand('install', 'system', 'org.mozilla.firefox');
assert(systemInstall.cmd === 'pkexec', 'System-scope install runs through pkexec');
assert(systemInstall.args[0] === 'flatpak' && systemInstall.args.includes('--system'), 'System-scope install passes --system to flatpak via pkexec');

const userRemove = buildFlathubCommand('remove', 'user', 'org.mozilla.firefox');
assert(userRemove.cmd === 'flatpak' && userRemove.args[0] === 'uninstall', 'User-scope remove runs flatpak uninstall directly');

const systemRemove = buildFlathubCommand('remove', 'system', 'org.mozilla.firefox');
assert(systemRemove.cmd === 'pkexec' && systemRemove.args.includes('uninstall'), 'System-scope remove runs through pkexec');
assert(!systemRemove.args.includes('flathub'), 'Uninstall does not reference the remote name (only install needs it)');

// ─────────────────────────────────────────────────────────────
// 2. Install Scope Detection (live — read-only, no mutation)
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Install Scope Detection ──');

async function testScopeDetection() {
  const scope = await getFlathubInstallScope();
  assert(scope === 'system' || scope === 'user' || scope === null, 'Returns a valid scope value', `got ${scope}`);
}

// ─────────────────────────────────────────────────────────────
// 3. Live API Endpoints
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Live API Endpoints ──');

async function testLiveEndpoints() {
  try {
    const searchRes = await fetch(`${API}/api/search/flathub?q=firefox`);
    assert(searchRes.status === 200, 'GET /api/search/flathub returns 200');
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.results), 'Search response has results array');
    assert(searchData.results.length > 0, 'Search for "firefox" returns at least one hit');
    assert(searchData.results.every(r => r.Source === 'flathub'), 'All search results tagged Source: flathub');
    assert(searchData.results.every(r => typeof r.AppId === 'string' && r.AppId.includes('.')), 'All results have a reverse-DNS AppId');

    const emptyRes = await fetch(`${API}/api/search/flathub?q=`);
    const emptyData = await emptyRes.json();
    assert(Array.isArray(emptyData.results) && emptyData.results.length === 0, 'Empty query returns empty results, not an error');

    const infoRes = await fetch(`${API}/api/info/flathub?appId=org.mozilla.firefox`);
    assert(infoRes.status === 200, 'GET /api/info/flathub returns 200');
    const infoData = await infoRes.json();
    const info = infoData.results?.[0];
    assert(info?.AppId === 'org.mozilla.firefox', 'Info endpoint returns matching AppId');
    assert(info?.Source === 'flathub', 'Info result tagged Source: flathub');
    assert(typeof info?.Description === 'string' && !info.Description.includes('<'), 'Description HTML is stripped to plain text');

    const missingRes = await fetch(`${API}/api/info/flathub?appId=org.this.does.not.exist.xyz`);
    const missingData = await missingRes.json();
    assert(Array.isArray(missingData.results) && missingData.results.length === 0, 'Nonexistent AppId returns empty results, not a crash');
  } catch (err) {
    console.log('  ⓘ Backend not running on :3001, or Flathub API unreachable:', err.message);
  }
}

async function main() {
  await testScopeDetection();
  await testLiveEndpoints();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
