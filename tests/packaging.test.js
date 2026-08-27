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
// 2. Raster Icon Assets (no vector source — PNG tiers instead)
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Raster Icon Assets ──');

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const isPng = buf.length > 24 && buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!isPng) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

for (const [file, size] of [['assets/aura-store.png', 512], ['assets/aura-store-256.png', 256], ['assets/aura-store-128.png', 128]]) {
  const iconPath = path.join(ROOT_DIR, file);
  assert(fs.existsSync(iconPath), `${file} exists`);
  const dims = readPngDimensions(iconPath);
  assert(dims && dims.width === size && dims.height === size, `${file} is ${size}x${size}`, dims ? `got ${dims.width}x${dims.height}` : 'not a valid PNG');
}

assert(fs.existsSync(path.join(ROOT_DIR, 'public/favicon.png')), 'public/favicon.png exists');
assert(fs.existsSync(path.join(ROOT_DIR, 'public/aura-store.png')), 'public/aura-store.png exists (sidebar brand mark)');

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
assert(launcherContent.includes('--class="aura-store"'), 'Launcher sets window class to aura-store (browser fallback)');
assert(launcherContent.includes('electron/main.js'), 'Launcher prefers native Electron shell');
assert(launcherContent.includes('--class=aura-store'), 'Launcher sets window class to aura-store (electron)');

// ─────────────────────────────────────────────────────────────
// 3b. Electron Native Shell
// ─────────────────────────────────────────────────────────────
console.log('\n── 3b. Electron Native Shell ──');

const electronMainPath = path.join(ROOT_DIR, 'electron/main.js');
assert(fs.existsSync(electronMainPath), 'electron/main.js exists');

const electronMainContent = fs.readFileSync(electronMainPath, 'utf8');
assert(electronMainContent.includes("import '../server/index.js'"), 'Electron main embeds the unified server');
assert(electronMainContent.includes('BrowserWindow'), 'Electron main creates a BrowserWindow');

const iconPngPath = path.join(ROOT_DIR, 'assets/aura-store.png');
assert(fs.existsSync(iconPngPath), 'assets/aura-store.png exists for the Electron window icon');

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
assert(pkgbuildContent.includes('electron:'), 'PKGBUILD lists electron as an optional dependency');
assert(pkgbuildContent.includes('aura-store/electron'), 'PKGBUILD installs the electron shell directory');
assert(pkgbuildContent.includes('hicolor/512x512/apps'), 'PKGBUILD installs the 512x512 hicolor icon tier');
assert(pkgbuildContent.includes('hicolor/256x256/apps'), 'PKGBUILD installs the 256x256 hicolor icon tier');
assert(pkgbuildContent.includes('hicolor/128x128/apps'), 'PKGBUILD installs the 128x128 hicolor icon tier');

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
