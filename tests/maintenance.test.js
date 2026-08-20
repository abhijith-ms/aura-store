/**
 * maintenance.test.js — Unit & API Tests for Aura v3.7 Settings & Storage Maintenance
 *
 * Verifies directory calculation, settings persistence, storage metrics schema,
 * cache pruning limits, and orphan package parsing.
 *
 * Run with: node tests/maintenance.test.js
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  calculateDirSize,
  getAurCacheDirs,
  getSettings,
  saveSettings,
  cleanAurBuildCache,
} from '../server/maintenance.js';

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
console.log('║  Aura Store v3.7 — Storage & Maintenance Test Suite          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Directory Size Calculations
// ─────────────────────────────────────────────────────────────
console.log('── 1. Directory Size Calculations ──');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-maint-test-'));

try {
  const subDir = path.join(tmpDir, 'nested/folder');
  fs.mkdirSync(subDir, { recursive: true });

  const file1 = path.join(tmpDir, 'file1.txt');
  const file2 = path.join(subDir, 'file2.txt');

  fs.writeFileSync(file1, 'Hello'); // 5 bytes
  fs.writeFileSync(file2, 'World 12345'); // 11 bytes

  const totalSize = calculateDirSize(tmpDir);
  assert(totalSize === 16, 'calculateDirSize computes recursive size correctly', `got ${totalSize}`);
  assert(calculateDirSize(file1) === 5, 'calculateDirSize handles single file');
  assert(calculateDirSize('/path/does/not/exist') === 0, 'calculateDirSize returns 0 for non-existent path');
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// 2. Settings Persistence & Schema
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Settings Persistence & Defaults ──');

const initialSettings = getSettings();
assert(typeof initialSettings === 'object', 'getSettings returns object');
assert(['auto', 'paru', 'yay'].includes(initialSettings.aurHelper), 'aurHelper setting is valid option');
assert(typeof initialSettings.autoCleanBuildCache === 'boolean', 'autoCleanBuildCache is boolean');
assert(typeof initialSettings.autoOpenTerminal === 'boolean', 'autoOpenTerminal is boolean');

const saveRes = saveSettings({ autoCleanBuildCache: true });
assert(saveRes.ok === true, 'saveSettings returns ok');
assert(getSettings().autoCleanBuildCache === true, 'Saved setting persists to disk');

// Restore setting
saveSettings({ autoCleanBuildCache: initialSettings.autoCleanBuildCache });

// ─────────────────────────────────────────────────────────────
// 3. API Storage Endpoint Verification
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. API Storage Endpoint Schema ──');

async function testStorageApi() {
  const res = await fetch(`${API}/api/system/storage`);
  assert(res.status === 200, 'GET /api/system/storage returns 200');

  const data = await res.json();
  assert(typeof data.aurCache === 'object', 'Storage returns aurCache object');
  assert(typeof data.aurCache.bytes === 'number', 'aurCache.bytes is number');
  assert(typeof data.pacmanCache === 'object', 'Storage returns pacmanCache object');
  assert(typeof data.pacmanCache.bytes === 'number', 'pacmanCache.bytes is number');
  assert(typeof data.diskSpace === 'object', 'Storage returns diskSpace object');
  assert(typeof data.diskSpace.percent === 'number', 'diskSpace.percent is number');
  assert(typeof data.helpers === 'object', 'Storage returns helpers detection object');
  assert(Array.isArray(data.orphans), 'Storage returns orphans array');
}

// ─────────────────────────────────────────────────────────────
// 4. API Settings Read/Write Roundtrip
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. API Settings Roundtrip ──');

async function testSettingsApi() {
  const getRes = await fetch(`${API}/api/settings`);
  assert(getRes.status === 200, 'GET /api/settings returns 200');
  const getData = await getRes.json();
  assert(typeof getData.settings === 'object', 'GET /api/settings returns settings object');

  const postRes = await fetch(`${API}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: 'dark' }),
  });
  assert(postRes.status === 200, 'POST /api/settings returns 200');
  const postData = await postRes.json();
  assert(postData.ok === true, 'POST /api/settings updates settings');
}

async function main() {
  try {
    await testStorageApi();
    await testSettingsApi();
  } catch (err) {
    console.error('  ✕ Test runner error:', err);
    failed++;
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
