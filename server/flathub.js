/**
 * flathub.js — Flathub search, app info, and install-scope detection.
 *
 * Search/info use Flathub's public v2 REST API (flathub.org/api/v2). Results
 * are shaped to match the AUR RPC fields the rest of the app already expects,
 * tagged with Source: 'flathub' and AppId (the reverse-DNS flatpak ref used
 * for install/uninstall — distinct from Name, which is the human title
 * Flathub already provides).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const FLATHUB_API = 'https://flathub.org/api/v2';

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function emptyFlathubFields() {
  return {
    PackageBase: null,
    Depends: [],
    MakeDepends: [],
    CheckDepends: [],
    OptDepends: [],
  };
}

export async function searchFlathub(query) {
  const res = await fetch(`${FLATHUB_API}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, filters: [] }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.hits || [])
    .filter((hit) => hit.app_id)
    .map((hit) => ({
      Name: hit.name || hit.app_id,
      AppId: hit.app_id,
      Version: null, // not present in search hits, only /appstream/{id}
      Description: hit.summary || '',
      Source: 'flathub',
      IconUrl: hit.icon || null,
      URL: null,
      License: hit.project_license ? [hit.project_license] : [],
      Maintainer: hit.developer_name || null,
      Verified: Boolean(hit.verification_verified),
      InstallsLastMonth: hit.installs_last_month || 0,
      Popularity: 0,
      NumVotes: hit.favorites_count || 0,
      ...emptyFlathubFields(),
    }));
}

export async function getFlathubAppInfo(appId) {
  const res = await fetch(`${FLATHUB_API}/appstream/${encodeURIComponent(appId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.id) return null;
  return {
    Name: data.name || data.id,
    AppId: data.id,
    Version: data.releases?.[0]?.version || null,
    Description: stripHtml(data.description) || data.summary || '',
    Source: 'flathub',
    IconUrl: data.icon || null,
    URL: data.urls?.homepage || null,
    License: data.project_license ? [data.project_license] : [],
    Maintainer: data.developer_name || null,
    Verified: Boolean(data.metadata?.['flathub::verification::verified']),
    InstallsLastMonth: 0,
    Popularity: 0,
    NumVotes: 0,
    ...emptyFlathubFields(),
  };
}

/**
 * Flatpak remotes are scope-specific (a "flathub" remote added --user is
 * invisible to --system installs and vice versa). Use whichever scope this
 * system already has flathub configured in, preferring system since that's
 * how most distros (including ones with Flathub pre-enabled) set it up.
 */
export async function getFlathubInstallScope() {
  const [systemRemotes, userRemotes] = await Promise.all([
    execFileAsync('flatpak', ['remotes', '--system']).then((r) => r.stdout).catch(() => ''),
    execFileAsync('flatpak', ['remotes', '--user']).then((r) => r.stdout).catch(() => ''),
  ]);
  if (/^flathub\b/m.test(systemRemotes)) return 'system';
  if (/^flathub\b/m.test(userRemotes)) return 'user';
  return null;
}

/**
 * Pure command-builder, kept separate from getFlathubInstallScope/spawn so it's
 * unit-testable without ever touching flatpak/pkexec — system-scope commands
 * require real polkit authentication, which cannot be exercised in an automated
 * test without a human present.
 */
export function buildFlathubCommand(action, scope, appId) {
  if (action === 'remove') {
    return scope === 'system'
      ? { cmd: 'pkexec', args: ['flatpak', 'uninstall', '--system', '--noninteractive', '-y', appId] }
      : { cmd: 'flatpak', args: ['uninstall', '--user', '--noninteractive', '-y', appId] };
  }
  return scope === 'system'
    ? { cmd: 'pkexec', args: ['flatpak', 'install', '--system', '--noninteractive', '-y', 'flathub', appId] }
    : { cmd: 'flatpak', args: ['install', '--user', '--noninteractive', '-y', 'flathub', appId] };
}
