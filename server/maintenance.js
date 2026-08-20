import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SETTINGS_DIR = path.join(os.homedir(), '.config', 'aura');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  aurHelper: 'auto', // 'auto' | 'paru' | 'yay'
  theme: 'dark',     // 'dark' | 'light' | 'system'
  autoCleanBuildCache: false,
  autoOpenTerminal: false,
  confirmInstalls: true,
};

/**
 * Calculates directory size in bytes (uses fast du -sb with fallback).
 */
export function calculateDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  try {
    const out = execSync(`du -sb "${dirPath}" 2>/dev/null`, { encoding: 'utf8', timeout: 2000 });
    const match = out.match(/^(\d+)/);
    if (match) return parseInt(match[1], 10);
  } catch {}

  try {
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) return stats.size;

    let total = 0;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        const fileStat = fs.lstatSync(fullPath);
        if (!fileStat.isSymbolicLink()) {
          total += fileStat.isDirectory() ? calculateDirSize(fullPath) : fileStat.size;
        }
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Returns available AUR cache directories.
 */
export function getAurCacheDirs() {
  const home = os.homedir();
  return [
    path.join(home, '.cache', 'paru', 'clone'),
    path.join(home, '.cache', 'paru', 'diff'),
    path.join(home, '.cache', 'yay'),
  ];
}

/**
 * Returns overall storage metrics, cache footprints, and orphan packages.
 */
export async function getStorageMetrics() {
  const home = os.homedir();

  // 1. AUR Build Cache Size
  let aurCacheBytes = 0;
  const aurDirs = getAurCacheDirs();
  for (const dir of aurDirs) {
    aurCacheBytes += calculateDirSize(dir);
  }

  // 2. Pacman Cache Size
  const pacmanCacheDir = '/var/cache/pacman/pkg';
  const pacmanCacheBytes = calculateDirSize(pacmanCacheDir);

  // 3. Root Filesystem Disk Usage
  let diskSpace = { total: 0, used: 0, available: 0, percent: 0 };
  try {
    const { stdout } = await execAsync('df -k / 2>/dev/null');
    const lines = stdout.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      const totalKb = parseInt(parts[1], 10) || 0;
      const usedKb = parseInt(parts[2], 10) || 0;
      const availKb = parseInt(parts[3], 10) || 0;
      diskSpace = {
        total: totalKb * 1024,
        used: usedKb * 1024,
        available: availKb * 1024,
        percent: totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0,
      };
    }
  } catch {}

  // 4. Detected AUR Helpers
  let hasParu = false;
  let hasYay = false;
  try {
    await execAsync('command -v paru');
    hasParu = true;
  } catch {}
  try {
    await execAsync('command -v yay');
    hasYay = true;
  } catch {}

  // 5. Orphan Packages (Dependencies unneeded by any installed package)
  const orphans = await getOrphanPackages();

  return {
    aurCache: {
      bytes: aurCacheBytes,
      dirs: aurDirs.filter((d) => fs.existsSync(d)),
    },
    pacmanCache: {
      bytes: pacmanCacheBytes,
      path: pacmanCacheDir,
    },
    diskSpace,
    helpers: {
      paru: hasParu,
      yay: hasYay,
    },
    orphans,
  };
}

/**
 * Returns list of orphan packages with sizes.
 */
export async function getOrphanPackages() {
  const orphans = [];
  try {
    const { stdout } = await execAsync('pacman -Qtd 2>/dev/null');
    const lines = stdout.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const [name, version] = line.trim().split(' ');
      let sizeStr = '';
      let desc = '';
      try {
        const { stdout: infoOut } = await execAsync(`pacman -Qi ${name} 2>/dev/null`);
        const sizeMatch = infoOut.match(/^Installed Size\s*:\s*(.+)$/m);
        const descMatch = infoOut.match(/^Description\s*:\s*(.+)$/m);
        sizeStr = sizeMatch ? sizeMatch[1].trim() : '';
        desc = descMatch ? descMatch[1].trim() : '';
      } catch {}

      orphans.push({
        name,
        version,
        size: sizeStr,
        description: desc,
      });
    }
  } catch {}

  return orphans;
}

/**
 * Cleans AUR build cache files.
 */
export function cleanAurBuildCache(pkgName = null) {
  const aurDirs = getAurCacheDirs();
  let deletedCount = 0;
  let freedBytes = 0;

  for (const dir of aurDirs) {
    if (!fs.existsSync(dir)) continue;

    if (pkgName) {
      const target = path.join(dir, pkgName);
      if (fs.existsSync(target)) {
        const size = calculateDirSize(target);
        try {
          fs.rmSync(target, { recursive: true, force: true });
          freedBytes += size;
          deletedCount++;
        } catch {}
      }
    } else {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const size = calculateDirSize(itemPath);
          try {
            fs.rmSync(itemPath, { recursive: true, force: true });
            freedBytes += size;
            deletedCount++;
          } catch {}
        }
      } catch {}
    }
  }

  return { ok: true, deletedCount, freedBytes };
}

/**
 * Reads persistent settings from ~/.config/aura/settings.json
 */
export function getSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves settings to ~/.config/aura/settings.json
 */
export function saveSettings(newSettings) {
  try {
    if (!fs.existsSync(SETTINGS_DIR)) {
      fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return { ok: true, settings: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
