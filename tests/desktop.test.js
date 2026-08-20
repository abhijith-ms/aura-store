/**
 * desktop.test.js — Unit Tests for Aura v3.6 Desktop Entry Parsing
 *
 * Verifies pure .desktop file parsing: Name/Exec extraction, GUI/Terminal/NoDisplay
 * detection, Desktop Action section parsing, and XDG field-code stripping.
 *
 * Run with: node tests/desktop.test.js
 */

import { parseDesktopFile, stripFieldCodes } from '../server/desktopEntries.js';

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
console.log('║  Aura Store v3.6 — Desktop Entry Parsing Test Suite           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Basic Name/Exec extraction & GUI detection
// ─────────────────────────────────────────────────────────────
console.log('── 1. Basic Name/Exec Extraction ──');

{
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Firefox',
    'Exec=firefox %u',
    'Icon=firefox',
    'Terminal=false',
  ].join('\n');

  const entry = parseDesktopFile(content, 'firefox.desktop');
  assert(entry.name === 'Firefox', 'Extracts Name');
  assert(entry.exec === 'firefox', 'Extracts Exec (first word only)');
  assert(entry.icon === 'firefox', 'Extracts Icon');
  assert(entry.isGui === true, 'Terminal=false yields isGui true');
  assert(entry.actions.length === 0, 'No Actions= yields empty actions array');
}

{
  const content = ['[Desktop Entry]', 'Name=htop', 'Exec=htop', 'Terminal=true'].join('\n');
  const entry = parseDesktopFile(content, 'htop.desktop');
  assert(entry.isGui === false, 'Terminal=true yields isGui false');
}

{
  const content = ['[Desktop Entry]', 'Name=Hidden Helper', 'Exec=helper', 'NoDisplay=true'].join('\n');
  const entry = parseDesktopFile(content, 'helper.desktop');
  assert(entry.isGui === false, 'NoDisplay=true yields isGui false');
}

{
  const entry = parseDesktopFile('[Desktop Entry]\nType=Application', 'mystery-app.desktop');
  assert(entry.name === 'mystery-app', 'Falls back to filename stem when Name= missing');
  assert(entry.exec === 'mystery-app', 'Falls back to filename stem when Exec= missing');
}

// ─────────────────────────────────────────────────────────────
// 2. Desktop Action parsing
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Desktop Action Parsing ──');

{
  const content = [
    '[Desktop Entry]',
    'Name=Firefox',
    'Exec=firefox %u',
    'Actions=new-window;new-private-window;',
    '',
    '[Desktop Action new-window]',
    'Name=Open a New Window',
    'Exec=firefox --new-window',
    'Icon=window-new',
    '',
    '[Desktop Action new-private-window]',
    'Name=Open a New Private Window',
    'Exec=firefox --private-window',
  ].join('\n');

  const entry = parseDesktopFile(content, 'firefox.desktop');
  assert(entry.actions.length === 2, 'Extracts both declared actions', `got ${entry.actions.length}`);
  assert(entry.actions[0].id === 'new-window', 'First action id correct');
  assert(entry.actions[0].name === 'Open a New Window', 'First action Name= extracted from its own section');
  assert(entry.actions[0].exec === 'firefox --new-window', 'First action Exec= extracted from its own section');
  assert(entry.actions[0].icon === 'window-new', 'First action Icon= extracted from its own section');
  assert(entry.actions[1].id === 'new-private-window', 'Second action id correct');
  assert(entry.actions[1].name === 'Open a New Private Window', 'Second action Name= not bled from first section');
  assert(entry.actions[1].icon === null, 'Second action Icon= is null when omitted');
}

{
  const content = ['[Desktop Entry]', 'Name=NoActionsDeclared', 'Exec=app'].join('\n');
  const entry = parseDesktopFile(content, 'app.desktop');
  assert(Array.isArray(entry.actions) && entry.actions.length === 0, 'Missing Actions= yields empty array, not undefined');
}

// ─────────────────────────────────────────────────────────────
// 3. XDG field-code stripping
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Field Code Stripping ──');

assert(stripFieldCodes('firefox %u') === 'firefox', 'Strips trailing %u');
assert(stripFieldCodes('vlc %U') === 'vlc', 'Strips trailing %U');
assert(stripFieldCodes('app --open %f --flag') === 'app --open --flag', 'Strips mid-string %f, collapses whitespace');
assert(stripFieldCodes('gimp %F') === 'gimp', 'Strips %F');
assert(stripFieldCodes('code --new-window') === 'code --new-window', 'Leaves plain exec strings untouched');

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
