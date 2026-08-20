import fs from 'fs';
import path from 'path';
import os from 'os';

// Memory cache for icon path resolutions
const iconPathCache = new Map();
const MAX_CACHE_ENTRIES = 500;

// Preferred sizes in descending order of quality
const ICON_SUBDIRS = [
  'scalable/apps',
  '512x512/apps',
  '256x256/apps',
  '128x128/apps',
  '96x96/apps',
  '64x64/apps',
  '48x48/apps',
  '32x32/apps',
  '24x24/apps',
  '16x16/apps',
  'apps',
];

const EXTENSIONS = ['.svg', '.png', '.xpm', '.svgz', '.jpeg', '.jpg'];

const COMMON_THEMES = [
  'hicolor',
  'Adwaita',
  'breeze',
  'breeze-dark',
  'Papirus',
  'Papirus-Dark',
  'Yaru',
  'elementary',
  'gnome',
];

/**
 * Returns list of base icon search directories on the system.
 */
export function getIconSearchRoots() {
  const home = os.homedir();
  return [
    path.join(home, '.local/share/icons'),
    path.join(home, '.icons'),
    '/usr/local/share/icons',
    '/usr/share/icons',
    '/usr/share/pixmaps',
    '/var/lib/flatpak/exports/share/icons',
    path.join(home, '.local/share/flatpak/exports/share/icons'),
  ].filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

/**
 * Finds the absolute file path for a given icon name or package name.
 *
 * @param {string} iconName - Icon name from Desktop Entry (or absolute path)
 * @param {string} [pkgName] - Optional package name fallback
 * @param {string[]} [customRoots] - Optional override roots for unit testing
 * @returns {string|null} Absolute file path to the resolved icon, or null if not found
 */
export function findSystemIconPath(iconName, pkgName = null, customRoots = null) {
  if (!iconName && !pkgName) return null;

  const cacheKey = `${iconName || ''}::${pkgName || ''}`;
  if (!customRoots && iconPathCache.has(cacheKey)) {
    return iconPathCache.get(cacheKey);
  }

  const roots = customRoots || getIconSearchRoots();

  // 1. Direct absolute path check
  if (iconName && (iconName.startsWith('/') || iconName.startsWith('.'))) {
    try {
      if (fs.existsSync(iconName) && fs.statSync(iconName).isFile()) {
        if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
          iconPathCache.set(cacheKey, iconName);
        }
        return iconName;
      }
      // Try appending extensions if path lacks one
      for (const ext of EXTENSIONS) {
        const full = `${iconName}${ext}`;
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
            iconPathCache.set(cacheKey, full);
          }
          return full;
        }
      }
    } catch {}
  }

  // 2. Build candidate names to search for
  const candidateNames = [];
  if (iconName) {
    candidateNames.push(iconName);
    // Remove extension if present in iconName (e.g., "app.png" -> "app")
    const withoutExt = iconName.replace(/\.(png|svg|xpm|svgz|jpg|jpeg)$/i, '');
    if (withoutExt !== iconName) {
      candidateNames.push(withoutExt);
    }
  }

  if (pkgName) {
    candidateNames.push(pkgName);
    const cleanPkg = pkgName.replace(/-(?:bin|git|desktop|electron|app|nightly|preview|stable|beta)$/, '');
    if (cleanPkg !== pkgName) {
      candidateNames.push(cleanPkg);
    }
  }

  // Unique names
  const uniqueNames = [...new Set(candidateNames.filter(Boolean))];

  for (const root of roots) {
    // A. Check directly in root (e.g. /usr/share/pixmaps/name.png)
    for (const name of uniqueNames) {
      for (const ext of EXTENSIONS) {
        const candidate = path.join(root, `${name}${ext}`);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
              iconPathCache.set(cacheKey, candidate);
            }
            return candidate;
          }
        } catch {}
      }
      // Also check exact file name if name already had extension
      const exactCandidate = path.join(root, name);
      try {
        if (fs.existsSync(exactCandidate) && fs.statSync(exactCandidate).isFile()) {
          if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
            iconPathCache.set(cacheKey, exactCandidate);
          }
          return exactCandidate;
        }
      } catch {}
    }

    // B. Check within theme subdirectories (hicolor, Adwaita, etc.)
    for (const theme of COMMON_THEMES) {
      const themeRoot = path.join(root, theme);
      if (!fs.existsSync(themeRoot)) continue;

      for (const subDir of ICON_SUBDIRS) {
        const searchDir = path.join(themeRoot, subDir);
        if (!fs.existsSync(searchDir)) continue;

        for (const name of uniqueNames) {
          for (const ext of EXTENSIONS) {
            const candidate = path.join(searchDir, `${name}${ext}`);
            try {
              if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
                  iconPathCache.set(cacheKey, candidate);
                }
                return candidate;
              }
            } catch {}
          }
        }
      }
    }
  }

  if (!customRoots && iconPathCache.size < MAX_CACHE_ENTRIES) {
    iconPathCache.set(cacheKey, null);
  }
  return null;
}

/**
 * Returns MIME type based on icon file extension.
 */
export function getIconMimeType(filePath) {
  if (!filePath) return 'application/octet-stream';
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.svg':
    case '.svgz':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.xpm':
      return 'image/x-xpixmap';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}
