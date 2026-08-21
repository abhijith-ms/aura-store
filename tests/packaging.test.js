/**
 * packaging.test.js — Packaging & Desktop Integration Test Suite
 *
 * Verifies XDG desktop file structure, vector icon assets, launcher scripts,
 * unified Express production runtime, and Arch PKGBUILD correctness.
 *
 * Run with: node tests/packaging.test.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseDesktopFile } from '../server/desktopEntries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
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
console.log('║  Aura Store v4.0 — Packaging & Desktop Integration Tests     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. XDG Desktop Entry Verification
// ─────────────────────────────────────────────────────────────
console.log('── 1. Desktop Entry Integrity ──');

const desktopPath = path.join(ROOT_DIR, 'aura-store.desktop');
assert(fs.existsSync(desktopPath), 'aura-store.desktop exists in root');

const desktopContent = fs.readFileSync(desktopPath, 'utf8');
const entry = parseDesktopFile(desktopContent, 'aura-store.desktop');

assert(entry.name === 'Aura Store', 'Desktop entry name is "Aura Store"');
assert(entry.exec === 'aura-store', 'Desktop entry exec is "aura-store"');
assert(entry.icon === 'aura-store', 'Desktop entry icon is "aura-store"');
assert(entry.isGui === true, 'Desktop entry is marked as GUI');
assert(entry.actions.length === 2, 'Extracts 2 desktop actions (updates, explore)');
assert(entry.actions.some((a) => a.id === 'updates'), 'Has "updates" desktop action');
assert(entry.actions.some((a) => a.id === 'explore'), 'Has "explore" desktop action');

// ─────────────────────────────────────────────────────────────
// 2. Vector SVG Icon Asset
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Vector Icon Assets ──');

const iconPath = path.join(ROOT_DIR, 'assets/aura-store.svg');
assert(fs.existsSync(iconPath), 'assets/aura-store.svg exists');

const iconContent = fs.readFileSync(iconPath, 'utf8');
assert(iconContent.includes('<svg') && iconContent.includes('</svg>'), 'Valid SVG markup');
assert(iconContent.includes('viewBox="0 0 512 512"'), 'SVG has 512x512 canvas definition');

// ─────────────────────────────────────────────────────────────
// 3. Desktop Launcher Script
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Desktop Launcher Script ──');

const launcherPath = path.join(ROOT_DIR, 'bin/aura-store');
assert(fs.existsSync(launcherPath), 'bin/aura-store exists');

const stat = fs.statSync(launcherPath);
const isExecutable = (stat.mode & 0o111) !== 0;
assert(isExecutable, 'bin/aura-store has executable permissions (+x)');

const launcherContent = fs.readFileSync(launcherPath, 'utf8');
assert(launcherContent.includes('PORT=3001'), 'Launcher targets unified port 3001');
assert(launcherContent.includes('--class="aura-store"'), 'Launcher sets window class to aura-store');

// ─────────────────────────────────────────────────────────────
// 4. Arch Linux PKGBUILD Verification
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. Arch Linux PKGBUILD ──');

const pkgbuildPath = path.join(ROOT_DIR, 'PKGBUILD');
assert(fs.existsSync(pkgbuildPath), 'PKGBUILD exists');

const pkgbuildContent = fs.readFileSync(pkgbuildPath, 'utf8');
assert(pkgbuildContent.includes('pkgname=aura-store-git'), 'PKGBUILD declares pkgname aura-store-git');
assert(pkgbuildContent.includes('depends='), 'PKGBUILD specifies depends');
assert(pkgbuildContent.includes('provides=(\'aura-store\')'), 'PKGBUILD provides aura-store');
assert(pkgbuildContent.includes('/usr/lib/aura-store'), 'PKGBUILD installs to /usr/lib/aura-store');

// ─────────────────────────────────────────────────────────────
// 5. Unified Server Static Serving
// ─────────────────────────────────────────────────────────────
console.log('\n── 5. Unified Server Static Serving ──');

async function testUnifiedServing() {
  try {
    const res = await fetch(`${API}/`);
    assert(res.status === 200, 'GET / on backend returns 200');
    const text = await res.text();
    assert(text.includes('Aura Store') || text.includes('id="root"'), 'GET / serves frontend HTML');
  } catch (err) {
    console.log('  ⓘ Backend not running on :3001 or in test mode:', err.message);
  }
}

async function main() {
  await testUnifiedServing();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('══════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
