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

// --- System Desktop Entry Indexer (Supports Multiple Entries per Package) ---
function getSystemDesktopEntries() {
  const dirs = [
    '/usr/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
  ];

  const entriesMap = new Map(); // key -> Array<{ filename, name, exec, isGui }>

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
          const item = {
            filename: f,
            name: nameMatch ? nameMatch[1].trim() : baseKey,
            exec: execMatch ? execMatch[1].trim().split(' ')[0] : baseKey,
            isGui,
          };

          if (!entriesMap.has(baseKey)) {
            entriesMap.set(baseKey, []);
          }
          entriesMap.get(baseKey).push(item);
        } catch {}
      }
    } catch {}
  }

  return entriesMap;
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

// --- Crash Recovery & Stale Lock Check ---
app.get('/api/recovery', async (req, res) => {
  const lockFile = '/var/lib/pacman/db.lck';
  const hasLock = fs.existsSync(lockFile);
  let isLockStale = false;
  let runningProcesses = [];

  try {
    const { stdout } = await execAsync('pgrep -a -E "(pacman|paru|makepkg)" 2>/dev/null').catch(() => ({ stdout: '' }));
    runningProcesses = stdout.trim().split('\n').filter(Boolean);
    // If lock exists but no pacman/paru process is running, it's a stale lock from a crash
    if (hasLock && runningProcesses.length === 0) {
      isLockStale = true;
    }
  } catch {}

  res.json({
    hasLock,
    isLockStale,
    runningProcesses,
  });
});

// --- Clean / Unlock Pacman Lock ---
app.post('/api/unlock', async (req, res) => {
  const lockFile = '/var/lib/pacman/db.lck';
  try {
    if (fs.existsSync(lockFile)) {
      await execAsync(`pkexec rm -f ${lockFile}`);
      return res.json({ ok: true, message: 'Database lock removed successfully' });
    }
    res.json({ ok: true, message: 'No lock file present' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

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
    const desktopEntriesMap = getSystemDesktopEntries();

    const { stdout: aurPkgs } = await execAsync('pacman -Qm 2>/dev/null').catch(() => ({ stdout: '' }));
    const { stdout: allPkgs } = await execAsync('pacman -Q 2>/dev/null').catch(() => ({ stdout: '' }));

    const aur = aurPkgs.trim().split('\n').filter(Boolean).map(l => {
      const [name, version] = l.split(' ');
      const cleanKey = name.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
      const entries = desktopEntriesMap.get(cleanKey) || desktopEntriesMap.get(name.toLowerCase()) || [];
      const guiEntries = entries.filter(e => e.isGui);
      const isLaunchable = guiEntries.length > 0;

      return {
        name,
        version,
        source: 'aur',
        isLaunchable,
        desktopFile: guiEntries[0]?.filename || null,
        desktopEntries: guiEntries,
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

// --- Operation State Machine & Execution Engine ---
const activeInstalls = new Map(); // pkg -> { child, send, state }

app.get('/api/install', (req, res) => {
  const { pkg, action = 'install' } = req.query;
  if (!pkg) return res.status(400).send('pkg required');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let currentState = 'resolving';

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const setState = (newState, extra = {}) => {
    currentState = newState;
    sendEvent('state_change', { state: newState, pkg, ...extra });
  };

  setState('resolving');

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

  // Spawn process with its own process group (detached: true) to enable clean subtree kill
  const child = spawn(cmd, args, {
    detached: true,
    env: {
      ...process.env,
      HOME: os.homedir(),
      SUDO_ASKPASS: askpassPath,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const session = { child, send: sendEvent, state: currentState };
  activeInstalls.set(pkg, session);

  let detectedError = null;

  const handleOutput = (d) => {
    const text = d.toString();
    sendEvent('log', text);

    // State machine transitions derived from real process output
    if (text.includes('Downloading') || text.includes('Retrieving sources') || text.includes('curl') || text.includes('PKGBUILDs up to date')) {
      if (currentState !== 'downloading') setState('downloading');

      // Extract real measured transfer metrics if present
      const speedMatch = text.match(/([\d.]+\s*(?:MB\/s|MiB\/s|kB\/s|KB\/s|GB\/s))/i);
      const sizeMatch = text.match(/([\d.]+[MGK]i?B?)\s+(?:of|\/)\s+([\d.]+[MGK]i?B?)/i);
      const percentMatch = text.match(/(\d{1,3})%/);

      if (speedMatch || sizeMatch || percentMatch) {
        sendEvent('metrics', {
          speed: speedMatch ? speedMatch[1] : null,
          downloaded: sizeMatch ? `${sizeMatch[1]} / ${sizeMatch[2]}` : null,
          percent: percentMatch ? parseInt(percentMatch[1], 10) : null,
        });
      }
    } else if (text.includes('Making package') || text.includes('Starting build') || text.includes('Compiling') || text.includes('gcc') || text.includes('ninja') || text.includes('cargo')) {
      if (currentState !== 'building') setState('building');
    } else if (text.includes('Installing') || text.includes('pacman -U') || text.includes('Starting package()') || text.includes('authenticat')) {
      if (currentState !== 'installing') setState('installing');
    }

    // Standardized Error Pattern Matching
    if (text.includes('was not found in the build directory and is not a URL')) {
      const match = text.match(/ERROR:\s*([^\s]+)\s*was not found/i);
      detectedError = {
        code: 'SOURCE_MISSING_MANUAL_DOWNLOAD',
        message: 'This package requires a source file that cannot be downloaded automatically.',
        filename: match ? match[1] : 'source package',
        recoverable: true,
      };
      if (match) autoLinkDownloadSources(pkg, match[1]);
    } else if (text.includes('unable to lock database') || text.includes('db.lck')) {
      detectedError = {
        code: 'PACMAN_LOCKED',
        message: 'Pacman database is currently locked by another process.',
        details: '/var/lib/pacman/db.lck exists',
        recoverable: true,
      };
    } else if (text.includes('failed to resolve dependencies') || text.includes('could not satisfy dependencies')) {
      detectedError = {
        code: 'DEPENDENCY_UNRESOLVED',
        message: 'Required dependencies could not be resolved in AUR or official repos.',
        details: text.trim(),
        recoverable: false,
      };
    } else if (text.includes('password incorrect') || text.includes('authentication failed')) {
      detectedError = {
        code: 'AUTH_FAILED',
        message: 'Root authentication was cancelled or failed.',
        recoverable: true,
      };
    } else if (text.includes('packages failed to build') || text.includes('failed in build()')) {
      if (!detectedError) {
        detectedError = {
          code: 'BUILD_FAILED',
          message: 'The package failed during the local makepkg compilation process.',
          details: text.trim(),
          recoverable: true,
        };
      }
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('close', code => {
    activeInstalls.delete(pkg);
    if (code === 0) {
      setState('completed');
      sendEvent('done', { status: 'success' });
    } else {
      setState('failed', { error: detectedError });
      sendEvent('done', { status: 'error', error: detectedError });
    }
    res.end();
  });

  child.on('error', err => {
    activeInstalls.delete(pkg);
    setState('failed', { error: { code: 'EXEC_ERROR', message: err.message, recoverable: false } });
    sendEvent('error', err.message);
    res.end();
  });

  req.on('close', () => {
    if (activeInstalls.has(pkg)) {
      const active = activeInstalls.get(pkg);
      try {
        process.kill(-active.child.pid, 'SIGTERM');
      } catch {}
      activeInstalls.delete(pkg);
    }
  });
});

// --- Clean Process Group Cancellation ---
app.post('/api/cancel', (req, res) => {
  const { pkg } = req.body;
  if (pkg && activeInstalls.has(pkg)) {
    const session = activeInstalls.get(pkg);
    try {
      // Kill the entire process subtree using negative PID
      process.kill(-session.child.pid, 'SIGTERM');
      session.send('log', '>> Installation cancelled by user. Terminating process tree…');
      session.send('state_change', { state: 'cancelled', pkg });
      session.send('done', { status: 'cancelled' });

      // Fallback SIGKILL after 1.5s grace period if still active
      setTimeout(() => {
        try {
          process.kill(-session.child.pid, 'SIGKILL');
        } catch {}
      }, 1500);
    } catch {}
    activeInstalls.delete(pkg);
    return res.json({ ok: true, cancelled: pkg });
  }
  res.json({ ok: false, error: 'No active installation found for package' });
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
  const { pkg, desktopFile } = req.body;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });

  const desktopEntriesMap = getSystemDesktopEntries();
  const cleanKey = pkg.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
  const entries = desktopEntriesMap.get(cleanKey) || desktopEntriesMap.get(pkg.toLowerCase()) || [];

  let target = desktopFile || entries[0]?.filename || pkg.replace(/-(?:bin|git)$/, '');

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
