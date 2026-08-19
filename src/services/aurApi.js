const API = 'http://localhost:3001';

export const searchPackages = async (q, by = 'name-desc') => {
  if (!q?.trim()) return [];
  const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}&by=${by}`);
  const data = await res.json();
  return data.results || [];
};

export const getPackageInfo = async (pkg) => {
  const res = await fetch(`${API}/api/info?pkg=${encodeURIComponent(pkg)}`);
  const data = await res.json();
  return data.results?.[0] || null;
};

// Known marketing display names for major software
const KNOWN_DISPLAY_NAMES = {
  'visual-studio-code-bin': 'Visual Studio Code',
  'spotify': 'Spotify',
  'google-chrome': 'Google Chrome',
  'zen-browser-bin': 'Zen Browser',
  'discord': 'Discord',
  'brave-bin': 'Brave Browser',
  'telegram-desktop': 'Telegram Desktop',
  'obs-studio-git': 'OBS Studio',
  'steam': 'Steam',
  'docker-desktop': 'Docker Desktop',
  'postman-bin': 'Postman',
  'insomnia-bin': 'Insomnia',
  'sublime-text-4': 'Sublime Text',
  'neovim-git': 'Neovim',
  'vlc-git': 'VLC Media Player',
  'retroarch': 'RetroArch',
  'prismlauncher-bin': 'Prism Launcher',
  'alacritty-git': 'Alacritty',
  'kitty-git': 'Kitty Terminal',
  'btop': 'Btop++',
  'fastfetch-git': 'Fastfetch',
  'stremio': 'Stremio',
  'tor-browser-bin': 'Tor Browser',
  'vivaldi': 'Vivaldi',
  'signal-desktop': 'Signal Desktop',
  'slack-desktop': 'Slack',
  'gimp': 'GIMP',
  'inkscape': 'Inkscape',
  'blender': 'Blender',
  'audacity': 'Audacity',
  'kodi': 'Kodi',
  'paru': 'Paru AUR Helper',
  'yay': 'Yay AUR Helper',
  'cursor-bin': 'Cursor IDE',
  'antigravity-ide': 'Antigravity IDE',
  'kiro-ide': 'Kiro IDE',
};

export const getAppDisplayName = (pkgName) => {
  if (!pkgName) return '';
  const key = pkgName.toLowerCase().trim();
  if (KNOWN_DISPLAY_NAMES[key]) return KNOWN_DISPLAY_NAMES[key];
  const baseKey = key.replace(/-(?:bin|git|desktop|electron|app|nightly|preview|stable|beta)$/, '');
  if (KNOWN_DISPLAY_NAMES[baseKey]) return KNOWN_DISPLAY_NAMES[baseKey];
  return pkgName;
};

// Known Desktop GUI applications that have valid XDG .desktop launchers
const KNOWN_GUI_APPS = new Set([
  'visual-studio-code-bin',
  'spotify',
  'zen-browser-bin',
  'google-chrome',
  'brave-bin',
  'discord',
  'telegram-desktop',
  'obs-studio-git',
  'steam',
  'postman-bin',
  'insomnia-bin',
  'sublime-text-4',
  'retroarch',
  'prismlauncher-bin',
  'stremio',
  'tor-browser-bin',
  'vivaldi',
  'signal-desktop',
  'slack-desktop',
  'gimp',
  'inkscape',
  'blender',
  'audacity',
  'kodi',
  'cursor-bin',
  'antigravity-ide',
  'kiro-ide',
  'packettracer',
  'vlc-git',
]);

const KNOWN_CLI_TOOLS = new Set([
  'paru',
  'yay',
  'btop',
  'fastfetch-git',
  'neovim-git',
  'alacritty-git',
  'kitty-git',
  'timeshift',
  'litellm',
]);

export const isLaunchable = (pkgName) => {
  if (!pkgName) return false;
  const key = pkgName.toLowerCase().trim();
  if (KNOWN_CLI_TOOLS.has(key)) return false;
  if (KNOWN_GUI_APPS.has(key)) return true;
  const baseKey = key.replace(/-(?:bin|git|desktop|electron|app|nightly|preview|stable|beta)$/, '');
  if (KNOWN_GUI_APPS.has(baseKey)) return true;
  if (key.endsWith('-desktop') || key.endsWith('-gui')) return true;
  return false;
};



export const getMultiplePackageInfo = async (pkgList) => {
  if (!pkgList || pkgList.length === 0) return [];
  try {
    const promises = pkgList.map(name => getPackageInfo(name).catch(() => null));
    const results = await Promise.all(promises);
    return results.filter(Boolean);
  } catch {
    return [];
  }
};

export const getInstalled = async () => {
  const res = await fetch(`${API}/api/installed`);
  return res.json();
};

export const launchApp = async (pkg) => {
  try {
    const res = await fetch(`${API}/api/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkg }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
};

export const cancelInstall = async (pkg) => {
  try {
    const res = await fetch(`${API}/api/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkg }),
    });
    return res.json();
  } catch {
    return { ok: false };
  }
};

export const openDownloadsFolder = async () => {

  try {
    const res = await fetch(`${API}/api/open-downloads`, { method: 'POST' });
    return res.json();
  } catch {
    return { ok: false };
  }
};




export const getUpdates = async () => {
  const res = await fetch(`${API}/api/updates`);
  return res.json();
};

export const getPkgbuild = async (pkg) => {
  const res = await fetch(`${API}/api/pkgbuild?pkg=${encodeURIComponent(pkg)}`);
  const data = await res.json();
  return data.pkgbuild || '';
};

export const checkRecovery = async () => {

  try {
    const res = await fetch(`${API}/api/recovery`);
    return res.json();
  } catch {
    return { hasLock: false, isLockStale: false, runningProcesses: [] };
  }
};

export const unlockPacman = async () => {
  try {
    const res = await fetch(`${API}/api/unlock`, { method: 'POST' });
    return res.json();
  } catch {
    return { ok: false };
  }
};

// --- Operation History Helper (Persistent) ---
const HISTORY_KEY = 'aura_operation_history_v1';

export const getOperationHistory = () => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addOperationHistory = (entry) => {
  try {
    const history = getOperationHistory();
    const updated = [
      { id: Date.now(), timestamp: new Date().toISOString(), ...entry },
      ...history,
    ].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

export const streamInstall = (pkg, action, callbacks, onDoneLegacy) => {
  const url = `${API}/api/install?pkg=${encodeURIComponent(pkg)}&action=${action}`;
  const es = new EventSource(url);

  // Normalize callbacks (support both legacy functional signature and modern structured handler)
  const isStructured = typeof callbacks === 'object';
  const onLog = isStructured ? callbacks.onLog : callbacks;
  const onStateChange = isStructured ? callbacks.onStateChange : null;
  const onMetrics = isStructured ? callbacks.onMetrics : null;
  const onDone = isStructured ? callbacks.onDone : onDoneLegacy;

  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'done') {
        es.close();
        const success = msg.data?.status === 'success' || msg.data === 'success';
        const error = msg.data?.error || null;
        if (onDone) onDone(success, error, msg.data?.status);
      } else if (msg.type === 'state_change') {
        if (onStateChange) onStateChange(msg.data);
      } else if (msg.type === 'metrics') {
        if (onMetrics) onMetrics(msg.data);
      } else {
        if (onLog) onLog(msg.data, msg.type);
      }
    } catch {}
  };

  es.onerror = () => {
    es.close();
    if (onDone) onDone(false, { code: 'NETWORK_ERROR', message: 'Connection to backend build stream lost.' }, 'error');
  };

  return () => es.close();
};


export const FEATURED = [
  { name: 'zen-browser-bin', icon: '🌊', label: 'Featured Browser' },
  { name: 'visual-studio-code-bin', icon: '🖥️', label: 'Popular IDE' },
  { name: 'spotify', icon: '🎵', label: 'Music & Streaming' },
  { name: 'discord', icon: '💬', label: 'Voice & Chat' },
];

export const TRENDING_NAMES = [
  'visual-studio-code-bin',
  'spotify',
  'google-chrome',
  'zen-browser-bin',
  'discord',
  'brave-bin',
  'paru',
  'yay',
  'telegram-desktop',
  'stremio',
  'cursor-bin',
  'antigravity-ide',
  'kiro-ide',
  'heroic-games-launcher-bin',
  'obs-studio-git',
  'prismlauncher-bin',
];

export const CATEGORIES = [
  {
    id: 'development',
    label: 'Development',
    icon: '⚙️',
    title: 'Developer Tools & IDEs',
    subtitle: 'High-performance code editors, compilers, language servers, and dev environments',
    packages: ['visual-studio-code-bin', 'cursor-bin', 'kiro-ide', 'antigravity-ide', 'sublime-text-4', 'postman-bin', 'insomnia-bin', 'docker-desktop'],
    query: 'code ide editor compiler',
  },
  {
    id: 'browsers',
    label: 'Browsers',
    icon: '🌐',
    title: 'Web Browsers',
    subtitle: 'Privacy-focused, lightweight, and modern browsing engines for Arch Linux',
    packages: ['zen-browser-bin', 'google-chrome', 'brave-bin', 'floorp-bin', 'microsoft-edge-stable-bin', 'tor-browser-bin', 'vivaldi', 'librewolf-bin'],
    query: 'browser web',
  },
  {
    id: 'media',
    label: 'Media & Audio',
    icon: '🎵',
    title: 'Audio, Video & Creation',
    subtitle: 'Music streaming, media players, streaming studios, and content creation suites',
    packages: ['spotify', 'stremio', 'obs-studio-git', 'spicetify-cli', 'cider', 'vlc-git', 'kodi', 'audacity'],
    query: 'audio music player video stream',
  },
  {
    id: 'gaming',
    label: 'Gaming',
    icon: '🎮',
    title: 'Gaming & Emulation',
    subtitle: 'Game launchers, compatibility layers, and gaming tools',
    packages: ['heroic-games-launcher-bin', 'lutris-git', 'prismlauncher-bin', 'bottles', 'retroarch', 'game-devices-udev', 'proton-ge-custom-bin'],
    query: 'game gaming launcher wine proton',
  },
  {
    id: 'tools',
    label: 'System Tools',
    icon: '🛠️',
    title: 'System Utilities & CLI',
    subtitle: 'Package helpers, performance monitors, terminal emulators, and system utilities',
    packages: ['paru', 'yay', 'btop', 'fastfetch-git', 'timeshift', 'btrfs-assistant', 'alacritty-git', 'kitty-git'],
    query: 'system tool terminal utility monitor',
  },
];

export const getPackageIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('code') || n.includes('vscode') || n.includes('ide') || n.includes('vim') || n.includes('emacs') || n.includes('cursor')) return '🖥️';
  if (n.includes('browser') || n.includes('chrome') || n.includes('firefox') || n.includes('zen') || n.includes('brave') || n.includes('floorp') || n.includes('edge')) return '🌐';
  if (n.includes('spotify') || n.includes('music') || n.includes('vlc') || n.includes('audio') || n.includes('cider') || n.includes('spicetify')) return '🎵';
  if (n.includes('discord') || n.includes('telegram') || n.includes('signal') || n.includes('chat') || n.includes('slack')) return '💬';
  if (n.includes('game') || n.includes('steam') || n.includes('lutris') || n.includes('heroic') || n.includes('prism') || n.includes('bottle')) return '🎮';
  if (n.includes('docker') || n.includes('container') || n.includes('kube')) return '🐳';
  if (n.includes('node') || n.includes('npm') || n.includes('python') || n.includes('rust') || n.includes('go')) return '📦';
  if (n.includes('git') || n.includes('github') || n.includes('gitlab')) return '🔀';
  if (n.includes('font') || n.includes('nerd')) return '🔤';
  if (n.includes('video') || n.includes('obs') || n.includes('stream') || n.includes('stremio')) return '📹';
  if (n.includes('photo') || n.includes('image') || n.includes('gimp') || n.includes('inkscape')) return '🎨';
  if (n.includes('terminal') || n.includes('shell') || n.includes('zsh') || n.includes('bash') || n.includes('alacritty') || n.includes('kitty')) return '⬛';
  if (n.includes('vpn') || n.includes('proxy') || n.includes('network') || n.includes('tor')) return '🔒';
  if (n.includes('backup') || n.includes('sync') || n.includes('cloud') || n.includes('timeshift')) return '☁️';
  if (n.includes('paru') || n.includes('yay') || n.includes('pacman')) return '⚡';
  return '📦';
};

export const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export const timeAgo = (unixTimestamp) => {
  if (!unixTimestamp) return 'Unknown';
  const diff = Date.now() / 1000 - unixTimestamp;
  if (diff < 86400) return 'Today';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${Math.floor(diff / (86400 * 365))}y ago`;
};
