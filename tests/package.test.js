/**
 * package.test.js — Unit Tests for Aura v3.4 Package View Model & Experience
 *
 * Verifies view model normalization, source awareness, dependency categorization,
 * and state resolution.
 *
 * Run with: node tests/package.test.js
 */

import { createPackageViewModel } from '../src/services/packageViewModel.js';

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
console.log('║  Aura Store v3.4 — Package View Model Test Suite             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────
// 1. Pure Transformation & Basic Normalization
// ─────────────────────────────────────────────────────────────
console.log('── 1. Basic Normalization & Source Awareness ──');

{
  const raw = {
    Name: 'visual-studio-code-bin',
    Version: '1.93.1-1',
    Description: 'Visual Studio Code binary release',
    PackageBase: 'visual-studio-code-bin',
    URL: 'https://code.visualstudio.com/',
    NumVotes: 1840,
    Popularity: 28.5,
    Maintainer: 'aur-maintainer',
    License: ['MIT'],
    Depends: ['gtk3', 'nss', 'libx11'],
    OptDepends: ['libsecret: for credential storage'],
    MakeDepends: ['git'],
  };

  const vm = createPackageViewModel(raw, {
    installedPackages: new Set(['visual-studio-code-bin']),
    updates: [{ name: 'visual-studio-code-bin' }],
    aurInstalledList: [
      {
        name: 'visual-studio-code-bin',
        isLaunchable: true,
        desktopEntries: [{ filename: 'code.desktop', name: 'Visual Studio Code', exec: 'code' }],
      },
    ],
  });

  assert(vm !== null, 'Model creation succeeds for valid package');
  assert(vm.name === 'visual-studio-code-bin', 'Preserves package name');
  assert(vm.displayName === 'Visual Studio Code', 'Resolves display name');
  assert(vm.isCustomDisplayName === true, 'Flags custom display name');
  assert(vm.source.type === 'aur', 'Source type is aur');
  assert(vm.source.label === 'AUR', 'Source label is AUR');
  assert(vm.upstream.homepage === 'https://code.visualstudio.com/', 'Upstream homepage mapped');
  assert(vm.upstream.aur === 'https://aur.archlinux.org/packages/visual-studio-code-bin', 'AUR page mapped');
  assert(vm.state.installed === true, 'Authoritative installed state resolved');
  assert(vm.state.updateAvailable === true, 'Update available state resolved');
  assert(vm.state.launchable === true, 'Launchable state resolved');
  assert(vm.launch.desktopEntries.length === 1, 'Desktop entries array preserved');
}

// ─────────────────────────────────────────────────────────────
// 2. Classification Agreement with Search Engine
// ─────────────────────────────────────────────────────────────
console.log('\n── 2. Classification Consistency ──');

{
  // Canonical / Main package
  const vm1 = createPackageViewModel({ Name: 'google-chrome' });
  assert(vm1.classification.role === 'canonical', 'google-chrome classified as canonical');
  assert(vm1.classification.label === 'Main package', 'User-facing label is Main package');

  // Official Variant
  const vm2 = createPackageViewModel({ Name: 'google-chrome-beta' });
  assert(vm2.classification.role === 'official_variant', 'google-chrome-beta classified as official_variant');
  assert(vm2.classification.label === 'Variant', 'User-facing label is Variant');

  // Related package
  const vm3 = createPackageViewModel({ Name: 'vscode-langservers-extracted' });
  assert(vm3.classification.role === 'related', 'vscode-langservers classified as related');
  assert(vm3.classification.label === 'Related package', 'User-facing label is Related package');
}

// ─────────────────────────────────────────────────────────────
// 3. Accurate Dependency Categorization
// ─────────────────────────────────────────────────────────────
console.log('\n── 3. Dependency Categorization ──');

{
  const rawWithDeps = {
    Name: 'test-app',
    Depends: ['glibc', 'openssl'],
    MakeDepends: ['cmake', 'gcc'],
    CheckDepends: ['pytest'],
    OptDepends: ['libappindicator: tray icon support'],
  };

  const vm = createPackageViewModel(rawWithDeps);
  assert(vm.dependencies.runtime.length === 2, 'Runtime dependencies length matches Depends');
  assert(vm.dependencies.make.length === 2, 'Make dependencies length matches MakeDepends');
  assert(vm.dependencies.check.length === 1, 'Check dependencies length matches CheckDepends');
  assert(vm.dependencies.optional.length === 1, 'Optional dependencies length matches OptDepends');

  const rawEmptyDeps = {
    Name: 'simple-script',
  };
  const vmEmpty = createPackageViewModel(rawEmptyDeps);
  assert(vmEmpty.dependencies.runtime.length === 0, 'Empty depends yields empty array');
  assert(vmEmpty.dependencies.make.length === 0, 'Empty make yields empty array');
  assert(vmEmpty.dependencies.check.length === 0, 'Empty check yields empty array');
  assert(vmEmpty.dependencies.optional.length === 0, 'Empty opt yields empty array');
}

// ─────────────────────────────────────────────────────────────
// 4. Immutability & Pure Transformation
// ─────────────────────────────────────────────────────────────
console.log('\n── 4. Immutability ──');

{
  const rawOriginal = { Name: 'spotify', NumVotes: 500 };
  const rawFrozen = Object.freeze({ ...rawOriginal });
  const vm = createPackageViewModel(rawFrozen);
  assert(vm.name === 'spotify', 'Processes frozen raw object without mutating it');
  assert(rawFrozen.Name === 'spotify', 'Raw object unchanged');
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('══════════════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
