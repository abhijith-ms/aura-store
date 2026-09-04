/**
 * githubReleases.js — resolves an installable .AppImage asset from a GitHub
 * repo's latest release. Shared by two sources:
 *   - AppImageHub catalog items (their feed only links to a GitHub repo, not
 *     a direct download — see appimagehub.js)
 *   - manually-added "owner/repo" entries (the GitHub Releases source)
 *
 * Unauthenticated GitHub API (60 req/hr/IP) — fine for on-demand lookups
 * triggered by a search/install click, not for bulk polling.
 */

const GITHUB_API = 'https://api.github.com';

async function ghFetch(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aura-store' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Basic existence + metadata check for the manual "Add from GitHub" flow. */
export async function getRepoMeta(owner, repo) {
  const data = await ghFetch(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!data) return null;
  return {
    owner,
    repo,
    name: data.name,
    description: data.description || '',
    homepage: data.homepage || data.html_url,
    stars: data.stargazers_count || 0,
    avatarUrl: data.owner?.avatar_url || null,
  };
}

export function pickAppImageAsset(assets) {
  if (!Array.isArray(assets)) return null;
  const appImages = assets.filter((a) => /\.appimage$/i.test(a.name));
  if (appImages.length === 0) return null;
  // Prefer an x86_64/amd64-tagged asset when multiple architectures are published.
  const arch = appImages.find((a) => /(x86_64|amd64)/i.test(a.name));
  return arch || appImages[0];
}

/**
 * Finds the latest release's .AppImage asset for owner/repo.
 * Returns null (not throws) when the repo/release/asset doesn't exist — the
 * caller shows this as "no AppImage available", not an error.
 */
export async function resolveLatestAppImageAsset(owner, repo) {
  const release = await ghFetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`
  );
  if (!release) return null;
  const asset = pickAppImageAsset(release.assets);
  if (!asset) return null;
  return {
    version: release.tag_name,
    releaseName: release.name || release.tag_name,
    releaseUrl: release.html_url,
    assetUrl: asset.browser_download_url,
    assetName: asset.name,
    assetSize: asset.size,
    publishedAt: release.published_at,
  };
}
