/**
 * packageViewModel.js — Pure normalization layer for Aura package detail.
 *
 * Transforms raw AUR / system metadata into a clean, normalized view model:
 *   - Clear distinction between Application identity and Package identity
 *   - Explicit Source / Repository model (AUR, prepared for official repositories)
 *   - Reuses existing deterministic package-family classification
 *   - Explicit upstream URLs (homepage, source/PKGBUILD, aur)
 *   - Precise dependency categorization (runtime, make, check, optional)
 *   - Launchability with desktopEntries array
 *   - Authoritative state representation (installed, updateAvailable, operation)
 *
 * Invariant: Must be a pure function. No network calls or mutation side-effects.
 */

import { getAppDisplayName, isLaunchable, formatNumber, timeAgo } from './aurApi.js';
import { normalizeQuery } from './search/normalizeQuery.js';
import { resolveQueryIdentity } from './search/applicationIdentity.js';
import { classifyPackage } from './search/classifyPackage.js';

/**
 * Normalizes a raw package object into a structured view model.
 *
 * @param {object} pkg - Raw package object from AUR API or local pacman query
 * @param {object} [context={}] - Authoritative system context
 * @param {Set<string>} [context.installedPackages] - Set of installed package names
 * @param {Array|Set} [context.updates] - Available updates
 * @param {Array} [context.aurInstalledList] - Installed AUR package list with desktopEntries
 * @param {object|null} [context.activeOperation] - Currently running operation if any
 * @returns {object|null} Normalized package view model
 */
export function createPackageViewModel(pkg, context = {}) {
  if (!pkg || !pkg.Name) return null;

  const pkgName = pkg.Name;
  const displayName = getAppDisplayName(pkgName);

  // 1. Identity & Classification (Consumes existing classification engine)
  const norm = normalizeQuery(displayName !== pkgName ? displayName : pkgName);
  const queryIdentity = resolveQueryIdentity(norm);
  const rawRole = classifyPackage(pkg, queryIdentity.identity, queryIdentity.variantTerms);

  // User-facing classification labels
  let roleLabel = 'General package';
  if (rawRole === 'canonical') {
    roleLabel = 'Main package';
  } else if (rawRole === 'official_variant') {
    roleLabel = 'Variant';
  } else if (rawRole === 'related') {
    roleLabel = 'Related package';
  }

  // 2. Source / Repository Concept
  const isOfficial = pkg.Source === 'official';
  // Chaotic-AUR is just another synced repo (Source: 'official' from pacman's
  // point of view), but it's community-built pre-compiled AUR packages, not
  // Arch's own maintainers — a distinct trust model that deserves its own
  // label instead of blending into "Official Arch Repository".
  const isChaoticAur = isOfficial && (pkg.Repository || '').toLowerCase() === 'chaotic-aur';
  const isFlathub = pkg.Source === 'flathub';
  const isAppImageHub = pkg.Source === 'appimagehub';
  const isGithubRelease = pkg.Source === 'github';
  const source = isChaoticAur
    ? {
        type: 'chaotic-aur',
        label: 'Chaotic-AUR',
        fullName: 'Chaotic-AUR',
        description: 'Community-built binary package from the Chaotic-AUR CI — a pre-compiled AUR package, not reviewed or signed by Arch\'s own maintainers',
      }
    : isOfficial
    ? {
        type: 'official',
        label: pkg.Repository || 'Official',
        fullName: 'Official Arch Repository',
        description: 'Maintained and signed by Arch Linux (or your distro\'s) package maintainers',
      }
    : isFlathub
    ? {
        type: 'flathub',
        label: 'Flathub',
        fullName: 'Flathub',
        description: 'Sandboxed app distributed via Flatpak, isolated from the rest of the system',
      }
    : isAppImageHub
    ? {
        type: 'appimagehub',
        label: 'AppImageHub',
        fullName: 'AppImageHub',
        description: 'Portable .AppImage — no package manager, sandboxing, or dependency install involved',
      }
    : isGithubRelease
    ? {
        type: 'github',
        label: 'GitHub',
        fullName: 'GitHub Releases',
        description: 'Portable .AppImage from the project\'s own GitHub Releases, added manually',
      }
    : {
        type: 'aur',
        label: 'AUR',
        fullName: 'Arch User Repository',
        description: 'Community-maintained build recipe for Arch Linux',
      };

  // Flathub identifies apps by their reverse-DNS AppId (e.g. org.mozilla.firefox),
  // not the human display name — install/uninstall and installed-state checks
  // must key off that instead of pkgName.
  const identityKey = isFlathub ? (pkg.AppId || pkgName) : pkgName;

  // 3. Upstream & Source Links
  const upstream = {
    homepage: pkg.URL || null,
    source: pkg.PackageBase ? `https://aur.archlinux.org/cgit/aur.git/tree/PKGBUILD?h=${encodeURIComponent(pkg.PackageBase)}` : null,
    aur: (isOfficial || isFlathub || isAppImageHub || isGithubRelease) ? null : `https://aur.archlinux.org/packages/${encodeURIComponent(pkgName)}`,
    flathub: isFlathub ? `https://flathub.org/apps/${encodeURIComponent(pkg.AppId || pkgName)}` : null,
    github: (isAppImageHub || isGithubRelease) && pkg.Owner && pkg.Repo ? `https://github.com/${pkg.Owner}/${pkg.Repo}` : null,
  };

  // 4. Dependencies categorized accurately by metadata fields
  const parseDepList = (list) => {
    if (!list) return [];
    if (Array.isArray(list)) return list.filter(Boolean);
    return [list];
  };

  const dependencies = {
    runtime: parseDepList(pkg.Depends),
    make: parseDepList(pkg.MakeDepends),
    check: parseDepList(pkg.CheckDepends),
    optional: parseDepList(pkg.OptDepends),
  };

  // 5. Metadata fields (omits empty/null fields cleanly)
  const metadata = {
    version: pkg.Version || null,
    packageBase: pkg.PackageBase || pkgName,
    maintainer: pkg.Maintainer || ((isOfficial || isFlathub || isAppImageHub || isGithubRelease) ? null : 'None (Orphaned)'),
    verified: Boolean(pkg.Verified),
    installsLastMonth: pkg.InstallsLastMonth || 0,
    license: pkg.License && pkg.License.length > 0 ? pkg.License.join(', ') : null,
    firstSubmitted: pkg.FirstSubmitted ? timeAgo(pkg.FirstSubmitted) : null,
    lastModified: pkg.LastModified ? timeAgo(pkg.LastModified) : null,
    outOfDate: Boolean(pkg.OutOfDate),
  };

  // 6. Launchability & Desktop Entries
  const installedInfo = context.aurInstalledList?.find(p => p.name === pkgName);
  const desktopEntries = installedInfo?.desktopEntries || (isLaunchable(pkgName) ? [{ filename: `${pkgName}.desktop`, name: displayName, exec: pkgName, isGui: true }] : []);
  const canLaunch = isLaunchable(pkgName) || desktopEntries.length > 0;

  // 7. State & Actions Context
  const isInstalled = context.installedPackages ? context.installedPackages.has(identityKey) : false;
  const isUpdate = isFlathub ? false : (context.updates ? (Array.isArray(context.updates) ? context.updates.some(u => (u.name || u.pkg || u) === pkgName) : context.updates.has(pkgName)) : false);
  const activeOp = context.activeOperation && context.activeOperation.pkg === pkgName ? context.activeOperation : null;

  return {
    name: pkgName,
    displayName,
    isCustomDisplayName: displayName !== pkgName,
    description: pkg.Description || '',
    source,
    classification: {
      role: rawRole,
      label: roleLabel,
      canonicalName: queryIdentity.identity?.canonicalName || displayName,
    },
    stats: {
      votes: pkg.NumVotes || 0,
      votesFormatted: formatNumber(pkg.NumVotes || 0),
      popularity: pkg.Popularity ? Number(pkg.Popularity.toFixed(1)) : 0,
      isPopular: (pkg.Popularity || 0) > 5,
    },
    metadata,
    dependencies,
    upstream,
    launch: {
      isLaunchable: canLaunch,
      desktopEntries,
    },
    state: {
      installed: isInstalled,
      updateAvailable: isUpdate,
      launchable: canLaunch && isInstalled,
      operation: activeOp,
    },
    raw: pkg,
  };
}
