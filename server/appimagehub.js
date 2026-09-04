/**
 * appimagehub.js — search/info against the AppImageHub community catalog
 * (appimage.github.io/feed.json). Results are shaped to match the AUR RPC
 * fields the rest of the app already expects, tagged Source: 'appimagehub'
 * (same convention as flathub.js).
 *
 * The catalog itself has no direct download URL or version — only a link to
 * the app's GitHub repo (when one exists; ~78% of entries). Actual install
 * resolves the .AppImage asset from that repo's latest release via
 * githubReleases.js. Entries without a GitHub link are shown but not
 * installable — the info panel just points at their download page.
 */

import { resolveLatestAppImageAsset } from './githubReleases.js';

const FEED_URL = 'https://appimage.github.io/feed.json';
const ICON_BASE = 'https://raw.githubusercontent.com/AppImage/appimage.github.io/master/database';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — catalog changes rarely

let cache = { items: null, fetchedAt: 0 };

function emptyAurShapeFields() {
  return {
    PackageBase: null,
    Depends: [],
    MakeDepends: [],
    CheckDepends: [],
    OptDepends: [],
  };
}

export function githubRepoFromLinks(links) {
  const gh = (links || []).find((l) => l.type === 'GitHub');
  if (!gh?.url) return null;
  const [owner, repo] = gh.url.split('/');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function downloadUrlFromLinks(links) {
  const dl = (links || []).find((l) => l.type === 'Download' || l.type === 'Install');
  return dl?.url || null;
}

async function getCatalog() {
  if (cache.items && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.items;
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`AppImageHub feed ${res.status}`);
  const data = await res.json();
  cache = { items: data.items || [], fetchedAt: Date.now() };
  return cache.items;
}

export function toSearchResult(item) {
  const gh = githubRepoFromLinks(item.links);
  return {
    Name: item.name,
    AppId: gh ? `${gh.owner}/${gh.repo}` : item.name,
    Version: null, // only known after resolving the GitHub release
    Description: item.description || '',
    Source: 'appimagehub',
    IconUrl: item.icons?.[0] ? `${ICON_BASE}/${item.icons[0]}` : null,
    URL: downloadUrlFromLinks(item.links),
    Owner: gh?.owner || null,
    Repo: gh?.repo || null,
    Installable: Boolean(gh),
    License: item.license ? [item.license] : [],
    Maintainer: item.authors?.[0]?.name || null,
    Verified: false,
    InstallsLastMonth: 0,
    Popularity: 0,
    NumVotes: 0,
    ...emptyAurShapeFields(),
  };
}

export async function searchAppImageHub(query) {
  const items = await getCatalog();
  const q = query.toLowerCase();
  const matches = items.filter(
    (it) => it.name?.toLowerCase().includes(q) || it.description?.toLowerCase().includes(q)
  );
  matches.sort((a, b) => {
    const aStarts = a.name?.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.name?.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.name.localeCompare(b.name);
  });
  return matches.slice(0, 40).map(toSearchResult);
}

/**
 * appId is "owner/repo" (installable entries) or the bare catalog name
 * (non-GitHub entries, download-page-only). Looks up the catalog by whichever
 * matches, then resolves the live release version/asset when installable.
 */
export async function getAppImageHubInfo(appId) {
  const items = await getCatalog();
  const item = items.find((it) => {
    const gh = githubRepoFromLinks(it.links);
    const ghId = gh ? `${gh.owner}/${gh.repo}` : null;
    return ghId === appId || it.name === appId;
  });
  if (!item) return null;

  const result = toSearchResult(item);
  if (result.Installable) {
    const asset = await resolveLatestAppImageAsset(result.Owner, result.Repo).catch(() => null);
    if (asset) {
      result.Version = asset.version;
      result._asset = asset; // consumed by the install route, not sent to old clients relying on exact shape
    }
  }
  return result;
}
