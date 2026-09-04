/**
 * manualInstallEngine.js — download + filesystem-integrate a .AppImage
 * (AppImageHub catalog items, manual GitHub Releases adds). No package
 * manager involved: this IS the install/uninstall implementation.
 *
 * Layout (all under $HOME, no root needed):
 *   ~/.local/bin/aura-<slug>.AppImage        the binary (chmod +x)
 *   ~/.local/share/icons/aura-manual/<slug>.<ext>
 *   ~/.local/share/applications/aura-<slug>.desktop
 *
 * State (version, file paths) is tracked in manualInstalls.json since none
 * of these files are owned/queried by pacman or flatpak.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { upsertManualInstall, removeManualInstall, listManualInstalls } from './manualInstalls.js';
import { resolveLatestAppImageAsset } from './githubReleases.js';

const BIN_DIR = path.join(os.homedir(), '.local', 'bin');
const ICON_DIR = path.join(os.homedir(), '.local', 'share', 'icons', 'aura-manual');
const APPS_DIR = path.join(os.homedir(), '.local', 'share', 'applications');

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
}

function ensureDirs() {
  for (const dir of [BIN_DIR, ICON_DIR, APPS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadWithProgress(url, destPath, onProgress) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  let downloaded = 0;
  let lastEmit = 0;

  const source = Readable.fromWeb(res.body);
  source.on('data', (chunk) => {
    downloaded += chunk.length;
    const now = Date.now();
    if (onProgress && now - lastEmit > 200) {
      lastEmit = now;
      onProgress({ downloaded, total, percent: total ? Math.round((downloaded / total) * 100) : null });
    }
  });

  await pipeline(source, fs.createWriteStream(destPath));
  if (onProgress) onProgress({ downloaded, total, percent: total ? 100 : null });
}

async function downloadIcon(iconUrl, slug) {
  if (!iconUrl) return null;
  try {
    const res = await fetch(iconUrl);
    if (!res.ok) return null;
    const ext = path.extname(new URL(iconUrl).pathname) || '.png';
    const dest = path.join(ICON_DIR, `${slug}${ext}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
    return dest;
  } catch {
    return null;
  }
}

function writeDesktopEntry({ slug, name, description, binPath, iconPath }) {
  const desktopPath = path.join(APPS_DIR, `aura-${slug}.desktop`);
  const comment = (description || '').replace(/\n/g, ' ').slice(0, 200);
  const content = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${name}`,
    comment ? `Comment=${comment}` : null,
    `Exec="${binPath}"`,
    `Icon=${iconPath || 'application-x-executable'}`,
    'Terminal=false',
    'Categories=Utility;',
    'X-AuraStore-ManualInstall=true',
    '',
  ].filter(Boolean).join('\n');
  fs.writeFileSync(desktopPath, content, { mode: 0o644 });
  return desktopPath;
}

/**
 * @param {{id: string, name: string, description: string, iconUrl: string|null,
 *   source: 'appimagehub'|'github', owner: string, repo: string,
 *   version: string, assetUrl: string}} appInfo
 * @param {(progress: {downloaded:number,total:number,percent:number|null}) => void} onProgress
 */
export async function installManualApp(appInfo, onProgress) {
  ensureDirs();
  const slug = slugify(appInfo.name);
  const binPath = path.join(BIN_DIR, `aura-${slug}.AppImage`);

  await downloadWithProgress(appInfo.assetUrl, binPath, onProgress);
  fs.chmodSync(binPath, 0o755);

  const iconPath = await downloadIcon(appInfo.iconUrl, slug);
  const desktopPath = writeDesktopEntry({
    slug,
    name: appInfo.name,
    description: appInfo.description,
    binPath,
    iconPath,
  });

  const record = {
    id: appInfo.id,
    name: appInfo.name,
    description: appInfo.description || '',
    source: appInfo.source,
    owner: appInfo.owner,
    repo: appInfo.repo,
    version: appInfo.version,
    binPath,
    iconPath,
    desktopPath,
    installedAt: Date.now(),
  };
  upsertManualInstall(record);
  return record;
}

export function uninstallManualApp(id) {
  const list = listManualInstalls();
  const entry = list.find((e) => e.id === id);
  if (!entry) return { ok: false, error: 'Not tracked as a manual install' };

  for (const p of [entry.binPath, entry.iconPath, entry.desktopPath]) {
    if (p) { try { fs.unlinkSync(p); } catch {} }
  }
  removeManualInstall(id);
  return { ok: true };
}

/** Polled by the background update checker alongside pacman/AUR updates. */
export async function checkManualInstallUpdates() {
  const list = listManualInstalls();
  const updates = [];
  for (const entry of list) {
    if (!entry.owner || !entry.repo) continue;
    try {
      const asset = await resolveLatestAppImageAsset(entry.owner, entry.repo);
      if (asset && asset.version !== entry.version) {
        updates.push({
          name: entry.name,
          id: entry.id,
          source: entry.source,
          currentVersion: entry.version,
          newVersion: asset.version,
        });
      }
    } catch {}
  }
  return updates;
}
