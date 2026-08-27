/**
 * officialRepo.js — Official Arch repository (core/extra/multilib, and any
 * distro-added repos like Chaotic-AUR/CachyOS) search & info via pacman's
 * local sync databases.
 *
 * Results are shaped to match the AUR RPC v5 fields the rest of the app
 * (rankPackages, classifyPackage, packageViewModel) already expects, tagged
 * with Source: 'official' so the UI can distinguish them from AUR results.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function emptyOfficialFields() {
  return {
    Popularity: 0,
    NumVotes: 0,
    PackageBase: null,
    Maintainer: null,
    License: [],
    URL: null,
    Depends: [],
    MakeDepends: [],
    CheckDepends: [],
    OptDepends: [],
  };
}

/** Parses `pacman -Ss <query>` output into AUR-RPC-shaped result objects. */
export function parseSearchOutput(stdout) {
  const lines = stdout.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i].match(/^(\S+)\/(\S+)\s+(\S+)(\s+\[installed(?::\s*(\S+))?\])?/);
    if (!headerMatch) continue;
    const [, repo, name, version, installedBracket, installedVersionExplicit] = headerMatch;
    const description = (lines[i + 1] || '').trim();
    results.push({
      Name: name,
      Version: version,
      Description: description,
      Repository: repo,
      Source: 'official',
      Installed: Boolean(installedBracket),
      InstalledVersion: installedVersionExplicit || (installedBracket ? version : null),
      ...emptyOfficialFields(),
    });
  }
  return results;
}

export async function searchOfficialRepos(query) {
  try {
    const { stdout } = await execFileAsync('pacman', ['-Ss', query]);
    return parseSearchOutput(stdout);
  } catch (err) {
    // `pacman -Ss` exits 1 with empty stdout when there are no matches, not an error.
    if (typeof err.stdout === 'string') return parseSearchOutput(err.stdout);
    return [];
  }
}

/** Parses `pacman -Si <pkg>` field-block output, honoring wrapped/continuation lines. */
function parseFieldBlock(stdout) {
  const raw = {};
  let currentKey = null;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) {
      currentKey = null;
      continue;
    }
    if (/^\s/.test(line)) {
      if (currentKey) raw[currentKey].push(line.trim());
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      currentKey = null;
      continue;
    }
    const key = line.slice(0, idx).trim();
    raw[key] = [line.slice(idx + 1).trim()];
    currentKey = key;
  }
  return raw;
}

const scalarField = (raw, key) => {
  const lines = raw[key];
  if (!lines) return null;
  const value = lines.join(' ').trim();
  return value && value !== 'None' ? value : null;
};

const listField = (raw, key) => {
  const value = scalarField(raw, key);
  return value ? value.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean) : [];
};

const optDepsField = (raw) => {
  const lines = raw['Optional Deps'];
  if (!lines || lines.length === 0) return [];
  if (lines.length === 1 && lines[0] === 'None') return [];
  return lines.filter(Boolean);
};

export function parseInfoOutput(stdout) {
  const raw = parseFieldBlock(stdout);
  const name = scalarField(raw, 'Name');
  if (!name) return null;
  return {
    Name: name,
    Version: scalarField(raw, 'Version'),
    Description: scalarField(raw, 'Description') || '',
    Repository: scalarField(raw, 'Repository'),
    Source: 'official',
    URL: scalarField(raw, 'URL'),
    License: listField(raw, 'Licenses'),
    Depends: listField(raw, 'Depends On'),
    OptDepends: optDepsField(raw),
    MakeDepends: [],
    CheckDepends: [],
    PackageBase: null,
    Maintainer: scalarField(raw, 'Packager'),
    Popularity: 0,
    NumVotes: 0,
  };
}

export async function getOfficialPackageInfo(pkg) {
  try {
    const { stdout } = await execFileAsync('pacman', ['-Si', pkg]);
    return parseInfoOutput(stdout);
  } catch {
    return null;
  }
}
