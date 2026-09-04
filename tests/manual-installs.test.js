/**
 * manual-installs.test.js — Unit tests for v5.0 AppImageHub / GitHub
 * Releases support: the GitHub release-asset picker, AppImageHub catalog
 * shaping, filesystem slug naming, and the manual-installs.json CRUD store.
 *
 * All pure/filesystem logic — no live network calls (that's exercised
 * manually via /api/search/appimagehub and /api/github/lookup).
 *
 * Run with: node tests/manual-installs.test.js
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { pickAppImageAsset } from '../server/githubReleases.js';
import { githubRepoFromLinks, toSearchResult } from '../server/appimagehub.js';
import { slugify } from '../server/manualInstallEngine.js';

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
console.log('║  Aura Store v5.0 — AppImageHub / GitHub Releases Test Suite  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. GitHub release asset picker
// ─────────────────────────────────────────────────────────────
console.log('── 1. .AppImage Asset Picker ──');

assert(pickAppImageAsset([]) === null, 'Empty asset list returns null');
assert(pickAppImageAsset(null) === null, 'Null asset list returns null');
assert(
  pickAppImageAsset([{ name: 'app-1.0.0.tar.gz' }, { name: 'app.deb' }]) === null,
  'No .AppImage present returns null (not the wrong asset type)'
);

const single = pickAppImageAsset([{ name: 'App-1.0.0.AppImage' }, { name: 'App-1.0.0.tar.gz' }]);
assert(single?.name === 'App-1.0.0.AppImage', 'Case-insensitive .AppImage match, ignores non-AppImage assets');

const multiArch = pickAppImageAsset([
  { name: 'App-1.0.0-i386.AppImage' },
  { name: 'App-1.0.0-x86_64.AppImage' },
  { name: 'App-1.0.0-armhf.AppImage' },
]);
assert(multiArch?.name === 'App-1.0.0-x86_64.AppImage', 'Prefers x86_64 asset when multiple architectures are published');

const noArchTag = pickAppImageAsset([{ name: 'App.AppImage' }]);
assert(noArchTag?.name === 'App.AppImage', 'Falls back to the only .AppImage when no arch is tagged in the name');

// ─────────────────────────────────────────────────────────────
// 2. AppImageHub catalog shaping
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. AppImageHub Catalog Shaping ──');

const ghLink = githubRepoFromLinks([{ type: 'GitHub', url: 'foo/bar' }]);
assert(ghLink?.owner === 'foo' && ghLink?.repo === 'bar', 'Extracts owner/repo from a GitHub-type link');
assert(githubRepoFromLinks([{ type: 'Download', url: 'https://example.com' }]) === null, 'No GitHub link present returns null');
assert(githubRepoFromLinks([]) === null, 'Empty links array returns null');
assert(githubRepoFromLinks(null) === null, 'Null links returns null (catalog entries with no links field)');

const installableItem = toSearchResult({
  name: 'TestApp',
  description: 'A test app',
  links: [{ type: 'GitHub', url: 'foo/bar' }],
  icons: ['TestApp/icons/512x512/x.png'],
  authors: [{ name: 'someone' }],
});
assert(installableItem.Source === 'appimagehub', 'Tagged with Source: appimagehub');
assert(installableItem.AppId === 'foo/bar', 'AppId is owner/repo when a GitHub link exists (matches install-time lookup key)');
assert(installableItem.Installable === true, 'Installable=true when a GitHub link exists');
assert(installableItem.IconUrl.startsWith('https://raw.githubusercontent.com/AppImage/appimage.github.io/master/database/'), 'Icon URL resolves against the real catalog raw-content base');

const downloadOnlyItem = toSearchResult({
  name: 'NoGithubApp',
  description: '',
  links: [{ type: 'Download', url: 'https://example.com/download' }],
});
assert(downloadOnlyItem.Installable === false, 'Installable=false with no GitHub link (download-page-only entries)');
assert(downloadOnlyItem.AppId === 'NoGithubApp', 'AppId falls back to catalog name when there is no owner/repo');
assert(downloadOnlyItem.URL === 'https://example.com/download', 'Falls back to the Download link as the external URL');

// ─────────────────────────────────────────────────────────────
// 3. Filesystem slug naming (must stay a safe, stable filename)
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Slug Naming ──');

assert(slugify('4KWALL') === '4kwall', 'Lowercases');
assert(slugify('My Cool App!') === 'my-cool-app', 'Non-alphanumerics collapse to single dashes, trimmed at edges');
assert(slugify('') === 'app', 'Empty name falls back to a safe default instead of an empty filename');
assert(!slugify('../../etc/passwd').includes('/'), 'Path separators from a hostile name never survive into the slug');

// ─────────────────────────────────────────────────────────────
// 4. manual-installs.json CRUD (isolated to a temp HOME)
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. Manual Installs Store ──');

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-manual-installs-test-'));
const realHome = os.homedir;
os.homedir = () => tmpHome;
const { listManualInstalls, upsertManualInstall, getManualInstall, removeManualInstall } = await import('../server/manualInstalls.js');
os.homedir = realHome;

assert(listManualInstalls().length === 0, 'Starts empty when no store file exists yet');

const entry = { id: 'foo/bar', name: 'Foo', version: 'v1.0.0', binPath: '/fake/path' };
upsertManualInstall(entry);
assert(listManualInstalls().length === 1, 'upsert adds a new entry');
assert(getManualInstall('foo/bar')?.version === 'v1.0.0', 'get returns the stored entry by id');

upsertManualInstall({ ...entry, version: 'v2.0.0' });
assert(listManualInstalls().length === 1, 'upsert on an existing id replaces it in place, does not duplicate');
assert(getManualInstall('foo/bar')?.version === 'v2.0.0', 'Replaced entry reflects the new version');

const removed = removeManualInstall('foo/bar');
assert(removed === true, 'remove reports success for an id that existed');
assert(listManualInstalls().length === 0, 'Entry gone after remove');
assert(removeManualInstall('nonexistent') === false, 'remove reports false for an id that was never there');

fs.rmSync(tmpHome, { recursive: true, force: true });

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
