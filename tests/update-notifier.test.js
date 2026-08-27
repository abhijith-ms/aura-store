/**
 * update-notifier.test.js — Unit Tests for background update notifications
 *
 * Verifies the pure diffing logic that decides which updates are "new"
 * since the last check, and the notification body formatting. Kept as pure
 * fixture tests since the real thing runs on a 30-minute timer and depends
 * on the browser Notification API — neither is practical to exercise live.
 *
 * Run with: node tests/update-notifier.test.js
 */

import { diffNewlyAvailableUpdates, formatUpdateNotificationBody } from '../src/services/updateNotifier.js';

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
console.log('║  Aura Store — Background Update Notification Test Suite      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Newly-Available Diffing
// ─────────────────────────────────────────────────────────────
console.log('── 1. Newly-Available Diffing ──');

{
  // First run (no baseline yet) must never report anything as "new" —
  // updates already visible at launch shouldn't trigger a notification,
  // the sidebar badge already shows them.
  const firstRun = diffNewlyAvailableUpdates(null, [{ name: 'firefox' }, { name: 'spotify' }]);
  assert(Array.isArray(firstRun) && firstRun.length === 0, 'First check (null baseline) reports zero new updates');

  // Same set as baseline — nothing new.
  const baseline = new Set(['firefox', 'spotify']);
  const unchanged = diffNewlyAvailableUpdates(baseline, [{ name: 'firefox' }, { name: 'spotify' }]);
  assert(unchanged.length === 0, 'Unchanged update set reports nothing new');

  // A genuinely new package appeared.
  const oneNew = diffNewlyAvailableUpdates(baseline, [{ name: 'firefox' }, { name: 'spotify' }, { name: 'discord' }]);
  assert(oneNew.length === 1 && oneNew[0] === 'discord', 'Detects exactly one newly-available update');

  // A package dropped out (e.g. user updated it manually) — not "new",
  // must not appear in the diff.
  const dropped = diffNewlyAvailableUpdates(baseline, [{ name: 'firefox' }]);
  assert(dropped.length === 0, 'A package no longer needing an update is not reported as new');

  // Multiple new packages at once.
  const multiNew = diffNewlyAvailableUpdates(baseline, [{ name: 'firefox' }, { name: 'spotify' }, { name: 'vlc' }, { name: 'obs-studio' }]);
  assert(multiNew.length === 2 && multiNew.includes('vlc') && multiNew.includes('obs-studio'), 'Detects multiple newly-available updates');

  // Empty/null update list from a failed or empty API response.
  const empty = diffNewlyAvailableUpdates(baseline, []);
  assert(empty.length === 0, 'Empty update list reports nothing new');
  const nullish = diffNewlyAvailableUpdates(baseline, null);
  assert(nullish.length === 0, 'Null update list does not throw and reports nothing new');
}

// ─────────────────────────────────────────────────────────────
// 2. Notification Body Formatting
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Notification Body Formatting ──');

{
  assert(formatUpdateNotificationBody(['firefox']) === 'Update available: firefox', 'Singular phrasing for exactly one update');

  const two = formatUpdateNotificationBody(['firefox', 'spotify']);
  assert(two === '2 package updates available: firefox, spotify', 'Plural phrasing lists all names when 3 or fewer');

  const five = formatUpdateNotificationBody(['firefox', 'spotify', 'discord', 'vlc', 'blender']);
  assert(five === '5 package updates available: firefox, spotify, discord…', 'Truncates to first 3 names with an ellipsis beyond that');
  assert(!five.includes('vlc') && !five.includes('blender'), 'Names beyond the first 3 are not listed verbatim');
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
