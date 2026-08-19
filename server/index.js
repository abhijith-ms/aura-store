import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const askpassPath = path.join(__dirname, 'askpass.sh');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- System Desktop Entry Indexer ---
function getSystemDesktopEntries() {
  const dirs = [
    '/usr/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
  ];

  const entries = new Map(); // key -> { filename, name, exec, isGui }

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (!f.endsWith('.desktop')) continue;
        const filePath = path.join(dir, f);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const isTerminal = /Terminal\s*=\s*true/i.test(content);
          const isNoDisplay = /NoDisplay\s*=\s*true/i.test(content);
          const isGui = !isTerminal && !isNoDisplay;

          const nameMatch = content.match(/^Name\s*=\s*(.+)$/m);
          const execMatch = content.match(/^Exec\s*=\s*(.+)$/m);

          const baseKey = f.replace(/\.desktop$/, '').toLowerCase();
          entries.set(baseKey, {
            filename: f,
            name: nameMatch ? nameMatch[1].trim() : baseKey,
            exec: execMatch ? execMatch[1].trim().split(' ')[0] : baseKey,
            isGui,
          });
        } catch {}
      }
    } catch {}
  }

  return entries;
}

// --- Helper to auto-link manual download sources from ~/Downloads into ~/.cache/paru/clone/<pkg>/ ---
function autoLinkDownloadSources(pkg, requiredFile = null) {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const cloneDir = path.join(os.homedir(), '.cache', 'paru', 'clone', pkg);

  try {
    if (!fs.existsSync(cloneDir)) {
      fs.mkdirSync(cloneDir, { recursive: true });
    }

    if (!fs.existsSync(downloadsDir)) return;
    const files = fs.readdirSync(downloadsDir);
    for (const f of files) {
      if (requiredFile && f.toLowerCase() === requiredFile.toLowerCase()) {
        const src = path.join(downloadsDir, f);
        const dest = path.join(cloneDir, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          console.log(`[Aura Smart Link] Auto-linked ${f} into build directory`);
        }
      } else if (!requiredFile && f.toLowerCase().includes(pkg.toLowerCase().replace(/-(?:bin|git)$/, ''))) {
        const src = path.join(downloadsDir, f);
        const dest = path.join(cloneDir, f);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          console.log(`[Aura Smart Link] Auto-linked ${f} into build directory`);
        }
      }
    }
  } catch (err) {
    console.error('[Aura Smart Link Error]', err);
  }
}

// --- AUR RPC v5 Proxy ---
app.get('/api/search', async (req, res) => {
  const { q, by = 'name-desc' } = req.query;
  if (!q || q.trim().length < 1) return res.json({ results: [] });
  try {
    const url = `https://aur.archlinux.org/rpc/v5/search/${encodeURIComponent(q)}?by=${by}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/info', async (req, res) => {
  const { pkg } = req.query;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });
  try {
    const url = `https://aur.archlinux.org/rpc/v5/info?arg[]=${encodeURIComponent(pkg)}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Installed packages with real system Desktop Entry verification ---
app.get('/api/installed', async (req, res) => {
  try {
    const desktopEntries = getSystemDesktopEntries();

    const { stdout: aurPkgs } = await execAsync('pacman -Qm 2>/dev/null').catch(() => ({ stdout: '' }));
    const { stdout: allPkgs } = await execAsync('pacman -Q 2>/dev/null').catch(() => ({ stdout: '' }));

    const aur = aurPkgs.trim().split('\n').filter(Boolean).map(l => {
      const [name, version] = l.split(' ');
      const cleanKey = name.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
      const desktop = desktopEntries.get(cleanKey) || desktopEntries.get(name.toLowerCase());
      const isLaunchable = Boolean(desktop && desktop.isGui);

      return {
        name,
        version,
        source: 'aur',
        isLaunchable,
        desktopFile: desktop?.filename || null,
      };
    });

    const allSet = new Set(allPkgs.trim().split('\n').filter(Boolean).map(l => l.split(' ')[0]));
    res.json({ aur, allInstalled: [...allSet] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Updates available ---
app.get('/api/updates', async (req, res) => {
  try {
    const { stdout } = await execAsync('paru -Qua 2>/dev/null').catch(() => ({ stdout: '' }));
    const updates = stdout.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[0], current: parts[1], latest: parts[3] };
    });
    res.json({ updates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Live install/remove via SSE ---
const activeInstalls = new Map();

app.get('/api/install', (req, res) => {
  const { pkg, action = 'install' } = req.query;
  if (!pkg) return res.status(400).send('pkg required');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  send('status', `Starting ${action} for ${pkg}...`);

  // Pre-check and auto-link any downloaded sources from ~/Downloads into build cache
  if (action === 'install') {
    autoLinkDownloadSources(pkg);
  }

  let cmd, args;
  if (action === 'remove') {
    cmd = 'pkexec';
    args = ['pacman', '-R', '--noconfirm', pkg];
  } else {
    cmd = 'paru';
    args = ['-S', '--noconfirm', '--noprogressbar', '--color', 'never', '--sudoflags', '-A', pkg];
  }

  const child = spawn(cmd, args, {
    env: {
      ...process.env,
      HOME: os.homedir(),
      SUDO_ASKPASS: askpassPath,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  activeInstalls.set(pkg, { child, send });

  child.stdout.on('data', d => {
    const text = d.toString();
    send('log', text);
    if (text.includes('was not found in the build directory and is not a URL')) {
      const match = text.match(/ERROR:\s*([^\s]+)\s*was not found/i);
      if (match) {
        autoLinkDownloadSources(pkg, match[1]);
      }
    }
  });

  child.stderr.on('data', d => {
    const text = d.toString();
    send('log', text);
    if (text.includes('was not found in the build directory and is not a URL')) {
      const match = text.match(/ERROR:\s*([^\s]+)\s*was not found/i);
      if (match) {
        autoLinkDownloadSources(pkg, match[1]);
      }
    }
  });

  child.on('close', code => {
    activeInstalls.delete(pkg);
    send('done', code === 0 ? 'success' : 'error');
    res.end();
  });

  child.on('error', err => {
    send('error', err.message);
    res.end();
  });

  req.on('close', () => {
    if (activeInstalls.has(pkg)) {
      activeInstalls.get(pkg).child.kill();
      activeInstalls.delete(pkg);
    }
  });
});

// --- Cancel active install ---
app.post('/api/cancel', (req, res) => {
  const { pkg } = req.body;
  if (pkg && activeInstalls.has(pkg)) {
    const session = activeInstalls.get(pkg);
    try {
      session.child.kill('SIGTERM');
      session.send('log', 'Installation cancelled by user.');
      session.send('done', 'cancelled');
    } catch {}
    activeInstalls.delete(pkg);
    return res.json({ ok: true, cancelled: pkg });
  }
  res.json({ ok: false, error: 'No active installation found' });
});

// --- Open Downloads Folder ---
app.post('/api/open-downloads', (req, res) => {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const child = spawn('xdg-open', [downloadsDir], { detached: true, stdio: 'ignore' });
  child.unref();
  res.json({ ok: true });
});

// --- Launch installed app ---
app.post('/api/launch', (req, res) => {
  const { pkg } = req.body;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });

  const desktopEntries = getSystemDesktopEntries();
  const cleanKey = pkg.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
  const desktop = desktopEntries.get(cleanKey) || desktopEntries.get(pkg.toLowerCase());

  let target = desktop ? desktop.filename : pkg.replace(/-(?:bin|git)$/, '');

  const child = spawn('gtk-launch', [target], { detached: true, stdio: 'ignore' });
  child.unref();

  child.on('error', () => {
    try {
      const fallback = spawn(target.replace(/\.desktop$/, ''), [], { detached: true, stdio: 'ignore' });
      fallback.unref();
    } catch {}
  });

  res.json({ ok: true, launched: target });
});

// --- PKGBUILD preview from AUR ---
app.get('/api/pkgbuild', async (req, res) => {
  const { pkg } = req.query;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });
  try {
    const url = `https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=${encodeURIComponent(pkg)}`;
    const resp = await fetch(url);
    const text = await resp.text();
    res.json({ pkgbuild: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Aura Store backend running on http://localhost:${PORT}`);
});
