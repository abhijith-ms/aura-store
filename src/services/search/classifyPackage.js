/**
 * classifyPackage.js — Classifies candidate packages into package family roles.
 *
 * Roles:
 *   - 'canonical': Top official package representing the application.
 *   - 'official_variant': Beta, Dev, Nightly, Insiders, ESR variants.
 *   - 'related': Extensions, language servers, devtools, drivers, configs, plugins.
 *   - 'general': Standard package with text match.
 */

const RELATED_INDICATORS = [
  'extension',
  'extensions',
  'plugin',
  'plugins',
  'theme',
  'themes',
  'icon',
  'icons',
  'langserver',
  'langservers',
  'language-server',
  'language-pack',
  'devtools',
  'driver',
  'chromedriver',
  'manifest',
  'policy',
  'bridge',
  'daemon',
  'helper',
  'patch',
  'wallpapers',
];

/**
 * Classify a package relative to a resolved identity and query.
 *
 * @param {object} pkg - AUR package object
 * @param {object|null} identity - Resolved identity from resolveQueryIdentity
 * @param {string[]} variantTerms - Variant terms present in query
 * @returns {'canonical' | 'official_variant' | 'related' | 'general'}
 */
export function classifyPackage(pkg, identity, variantTerms = []) {
  const pkgName = (pkg.Name || '').toLowerCase();

  if (!identity) {
    return 'general';
  }

  // 1. Check Canonical Packages
  if (identity.canonicalPackages?.includes(pkgName)) {
    return 'canonical';
  }

  // 2. Check Official Variants
  if (identity.variants?.includes(pkgName)) {
    return 'official_variant';
  }

  // Check for variant suffixes if base matches canonical
  for (const canon of identity.canonicalPackages || []) {
    const base = canon.replace(/-(?:bin|git)$/, '');
    if (pkgName.startsWith(base) && (pkgName.endsWith('-beta') || pkgName.endsWith('-dev') || pkgName.endsWith('-nightly') || pkgName.endsWith('-git') || pkgName.endsWith('-canary') || pkgName.endsWith('-insiders-bin'))) {
      return 'official_variant';
    }
  }

  // 3. Check Related Packages (extensions, devtools, language servers, etc.)
  if (identity.relatedPrefixes?.some(prefix => pkgName.startsWith(prefix))) {
    // If it is not a canonical or variant package, but starts with e.g. "vscode-" or "chrome-"
    return 'related';
  }

  const desc = (pkg.Description || '').toLowerCase();
  for (const indicator of RELATED_INDICATORS) {
    if (pkgName.includes(`-${indicator}`) || pkgName.includes(`${indicator}-`)) {
      return 'related';
    }
  }

  return 'general';
}
