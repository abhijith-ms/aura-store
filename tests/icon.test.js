/**
 * icon.test.js — Unit Tests for Aura v3.6.1 Icon Theme Resolution
 *
 * Verifies XDG icon theme resolution, directory precedence, size prioritization,
 * MIME type mapping, and fallbacks.
 *
 * Run with: node tests/icon.test.js
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { findSystemIconPath, getIconMimeType, getIconSearchRoots } from '../server/iconResolver.js';

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
console.log('║  Aura Store v3.6.1 — Icon Theme Resolution Test Suite        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. MIME Type Resolution
// ─────────────────────────────────────────────────────────────
console.log('── 1. MIME Type Resolution ──');

assert(getIconMimeType('/usr/share/icons/hicolor/scalable/apps/code.svg') === 'image/svg+xml', 'SVG maps to image/svg+xml');
assert(getIconMimeType('/usr/share/icons/hicolor/48x48/apps/chrome.png') === 'image/png', 'PNG maps to image/png');
assert(getIconMimeType('/usr/share/pixmaps/legacy.xpm') === 'image/x-xpixmap', 'XPM maps to image/x-xpixmap');
assert(getIconMimeType('/usr/share/pixmaps/photo.jpg') === 'image/jpeg', 'JPG maps to image/jpeg');
assert(getIconMimeType(null) === 'application/octet-stream', 'Null maps to octet-stream');

// ─────────────────────────────────────────────────────────────
// 2. Mock XDG Hierarchy & Size Priority
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. XDG Hierarchy & Priority Resolution ──');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-icon-test-'));

try {
  // Create mock structure:
  // tmpDir/hicolor/scalable/apps/app-svg.svg
  // tmpDir/hicolor/512x512/apps/app-512.png
  // tmpDir/hicolor/48x48/apps/app-48.png
  // tmpDir/pixmaps/app-pixmap.png
  const scalableDir = path.join(tmpDir, 'hicolor/scalable/apps');
  const size512Dir = path.join(tmpDir, 'hicolor/512x512/apps');
  const size48Dir = path.join(tmpDir, 'hicolor/48x48/apps');
  const pixmapsDir = path.join(tmpDir, 'pixmaps');

  fs.mkdirSync(scalableDir, { recursive: true });
  fs.mkdirSync(size512Dir, { recursive: true });
  fs.mkdirSync(size48Dir, { recursive: true });
  fs.mkdirSync(pixmapsDir, { recursive: true });

  const svgPath = path.join(scalableDir, 'myapp.svg');
  const png512Path = path.join(size512Dir, 'myapp.png');
  const png48Path = path.join(size48Dir, 'myapp.png');
  const pixmapPath = path.join(pixmapsDir, 'otherapp.png');
  const directPath = path.join(tmpDir, 'direct.png');

  fs.writeFileSync(svgPath, '<svg></svg>');
  fs.writeFileSync(png512Path, 'PNG512');
  fs.writeFileSync(png48Path, 'PNG48');
  fs.writeFileSync(pixmapPath, 'PIXMAP');
  fs.writeFileSync(directPath, 'DIRECT');

  const customRoots = [tmpDir, pixmapsDir];

  // Test Direct Path
  assert(findSystemIconPath(directPath, null, customRoots) === directPath, 'Direct absolute path resolves directly');

  // Test Theme Lookup (scalable SVG prioritized)
  const resolvedApp = findSystemIconPath('myapp', null, customRoots);
  assert(resolvedApp === svgPath, 'Scalable SVG prioritized in theme lookup');

  // Test Extension Truncation ("myapp.png" still finds myapp.svg if theme has scalable)
  const resolvedWithExt = findSystemIconPath('myapp.png', null, customRoots);
  assert(resolvedWithExt === svgPath, 'Strips raster extension when searching icon themes');

  // Test Pixmap Fallback
  const resolvedPixmap = findSystemIconPath('otherapp', null, customRoots);
  assert(resolvedPixmap === pixmapPath, 'Falls back to pixmaps directory');

  // Test Package Name Fallback
  const resolvedByPkg = findSystemIconPath(null, 'otherapp-bin', customRoots);
  assert(resolvedByPkg === pixmapPath, 'Falls back to package name stripped of -bin suffix');

  // Test Non-existent Icon
  const notFound = findSystemIconPath('nonexistent-icon-xyz', null, customRoots);
  assert(notFound === null, 'Returns null for non-existent icons');

  // Test Null inputs
  assert(findSystemIconPath(null, null, customRoots) === null, 'Returns null for null inputs');
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// 3. Live System Icon Search Roots
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Live System Environment ──');

const roots = getIconSearchRoots();
assert(Array.isArray(roots), 'Icon search roots returns an array');
assert(roots.some(r => r.includes('/usr/share/icons') || r.includes('/usr/share/pixmaps')), 'Contains system icon directories');

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
