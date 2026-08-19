/**
 * classifyPackage.js — Classifies candidate packages into package family roles.
 *
 * Roles:
 *   - 'canonical': Top official package representing the application.
 *   - 'official_variant': Official Beta, Dev, Nightly, Insiders, ESR browser/app variants.
 *   - 'related': Extensions, themes, language packs, devtools, drivers, configs, plugins.
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
  'i18n',
  'l10n',
  'langpack',
  'language-pack',
  'langserver',
  'langservers',
  'language-server',
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
  'adblock',
  'rpc',
  'sdk',
  'wrapper',
  'marketplace',
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

  // 1. Explicit Canonical Packages
  if (identity.canonicalPackages?.includes(pkgName)) {
    return 'canonical';
  }

  // 2. Check for Related indicators first (themes, extensions, langpacks, devtools)
  for (const indicator of RELATED_INDICATORS) {
    if (pkgName.includes(`-${indicator}`) || pkgName.includes(`${indicator}-`) || pkgName.endsWith(`-${indicator}`)) {
      return 'related';
    }
  }

  // 3. Explicit Official Variants
  if (identity.variants?.includes(pkgName)) {
    return 'official_variant';
  }

  // 4. Check for clean official variant suffixes (only for packages starting with canonical base)
  for (const canon of identity.canonicalPackages || []) {
    const base = canon.replace(/-(?:bin|git)$/, '');
    if (pkgName.startsWith(base) && (
      pkgName === `${base}-beta` ||
      pkgName === `${base}-beta-bin` ||
      pkgName === `${base}-dev` ||
      pkgName === `${base}-nightly` ||
      pkgName === `${base}-nightly-bin` ||
      pkgName === `${base}-git` ||
      pkgName === `${base}-canary` ||
      pkgName === `${base}-insiders-bin` ||
      pkgName === `${base}-developer-edition` ||
      pkgName === `${base}-esr` ||
      pkgName === `${base}-esr-bin`
    )) {
      return 'official_variant';
    }
  }

  // 5. Check Related Prefixes (e.g. "vscode-", "firefox-")
  if (identity.relatedPrefixes?.some(prefix => pkgName.startsWith(prefix))) {
    return 'related';
  }

  return 'general';
}
