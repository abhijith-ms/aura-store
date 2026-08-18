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

export const getInstalled = async () => {
  const res = await fetch(`${API}/api/installed`);
  return res.json();
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

export const streamInstall = (pkg, action, onLog, onDone) => {
  const url = `${API}/api/install?pkg=${encodeURIComponent(pkg)}&action=${action}`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'done') {
      es.close();
      onDone(msg.data === 'success');
    } else {
      onLog(msg.data, msg.type);
    }
  };
  es.onerror = () => {
    es.close();
    onDone(false);
  };
  return () => es.close();
};

export const FEATURED = [
  { name: 'zen-browser-bin', icon: '🌊', label: 'Featured Browser' },
  { name: 'visual-studio-code-bin', icon: '🖥️', label: 'Popular IDE' },
  { name: 'spotify', icon: '🎵', label: 'Music' },
  { name: 'discord', icon: '💬', label: 'Chat' },
];

export const CATEGORIES = [
  { id: 'development', label: 'Development', icon: '⚙️', query: 'ide editor code' },
  { id: 'browsers', label: 'Browsers', icon: '🌐', query: 'browser' },
  { id: 'media', label: 'Media', icon: '🎵', query: 'music player media' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', query: 'game gaming launcher' },
  { id: 'tools', label: 'System Tools', icon: '🛠️', query: 'system tool utility' },
];

export const getPackageIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('code') || n.includes('vscode') || n.includes('ide') || n.includes('vim') || n.includes('emacs')) return '🖥️';
  if (n.includes('browser') || n.includes('chrome') || n.includes('firefox') || n.includes('zen') || n.includes('brave')) return '🌐';
  if (n.includes('spotify') || n.includes('music') || n.includes('vlc') || n.includes('audio')) return '🎵';
  if (n.includes('discord') || n.includes('telegram') || n.includes('signal') || n.includes('chat')) return '💬';
  if (n.includes('game') || n.includes('steam') || n.includes('lutris') || n.includes('launch')) return '🎮';
  if (n.includes('docker') || n.includes('container') || n.includes('kube')) return '🐳';
  if (n.includes('node') || n.includes('npm') || n.includes('python') || n.includes('rust') || n.includes('go')) return '📦';
  if (n.includes('git') || n.includes('github') || n.includes('gitlab')) return '🔀';
  if (n.includes('font') || n.includes('nerd')) return '🔤';
  if (n.includes('video') || n.includes('obs') || n.includes('stream')) return '📹';
  if (n.includes('photo') || n.includes('image') || n.includes('gimp') || n.includes('inkscape')) return '🎨';
  if (n.includes('terminal') || n.includes('shell') || n.includes('zsh') || n.includes('bash')) return '⬛';
  if (n.includes('vpn') || n.includes('proxy') || n.includes('network')) return '🔒';
  if (n.includes('backup') || n.includes('sync') || n.includes('cloud')) return '☁️';
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
