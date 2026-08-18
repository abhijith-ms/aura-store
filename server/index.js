import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const askpassPath = path.join(__dirname, 'askpass.sh');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

// --- Installed packages ---
app.get('/api/installed', async (req, res) => {
  try {
    const { stdout: aurPkgs } = await execAsync('pacman -Qm 2>/dev/null').catch(() => ({ stdout: '' }));
    const { stdout: allPkgs } = await execAsync('pacman -Q 2>/dev/null').catch(() => ({ stdout: '' }));
    const aur = aurPkgs.trim().split('\n').filter(Boolean).map(l => {
      const [name, version] = l.split(' ');
      return { name, version, source: 'aur' };
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

  activeInstalls.set(pkg, child);
  child.stdout.on('data', d => send('log', d.toString()));
  child.stderr.on('data', d => send('log', d.toString()));
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
      activeInstalls.get(pkg).kill();
      activeInstalls.delete(pkg);
    }
  });
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
