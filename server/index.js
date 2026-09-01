import express from 'express';
import cors from 'cors';
import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { parseDesktopFile, stripFieldCodes } from './desktopEntries.js';
import { findSystemIconPath, getIconMimeType } from './iconResolver.js';
import {
  getStorageMetrics,
  cleanAurBuildCache,
  getOrphanPackages,
  getSettings,
  saveSettings,
} from './maintenance.js';
import { searchOfficialRepos, getOfficialPackageInfo } from './officialRepo.js';
import { searchFlathub, getFlathubAppInfo, getFlathubInstallScope, buildFlathubCommand } from './flathub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const askpassPath = path.join(__dirname, 'askpass.sh');

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ============================================================================
// 1. Flatpak Desktop Entry Indexer (fallback for packages pacman doesn't own)
// ============================================================================
function getSystemDesktopEntries() {
  const dirs = [
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
  ];

  const entriesMap = new Map(); // baseKey -> Array<{ filename, name, exec, isGui, actions, path }>

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (!f.endsWith('.desktop')) continue;
        const filePath = path.join(dir, f);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const item = { ...parseDesktopFile(content, f), path: filePath };
          const baseKey = f.replace(/\.desktop$/, '').toLowerCase();

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

// ============================================================================
// 1b. Authoritative pacman-owned Desktop Entry lookup (Multi-Entry Support)
// ============================================================================
async function getPacmanOwnedDesktopFiles(pkgName) {
  const { stdout } = await execFileAsync('pacman', ['-Qlq', pkgName]).catch(() => ({ stdout: '' }));
  const paths = stdout
    .trim()
    .split('\n')
    .filter((p) => /\/applications\/[^/]+\.desktop$/.test(p));

  const entries = [];
  for (const filePath of paths) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = path.basename(filePath);
      entries.push({ ...parseDesktopFile(content, filename), path: filePath });
    } catch {}
  }
  return entries;
}

// ============================================================================
// 2. Helper: Auto-link Manual Downloads (e.g. Cisco Packet Tracer, Oracle, etc.)
// ============================================================================
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

// ============================================================================
// 3. First-Class Operation Engine (State Machine, Concurrency & Lifecycle)
//
//    Concurrency Policy:
//      System-mutating operations (install, update, remove) are mutually exclusive.
//      Read-only operations (search, info, installed, pkgbuild) are always allowed.
//
//    Memory Limits:
//      MAX_HISTORY_ENTRIES = 50
//      MAX_LOG_LINES_PER_OP = 500
//      MAX_LOG_BYTES_PER_OP = 65536 (64 KB)
//
// ============================================================================
const LIMITS = {
  MAX_HISTORY_ENTRIES: 50,
  MAX_LOG_LINES: 500,
  MAX_LOG_BYTES: 65536,
  MAX_RECONNECT_REPLAY_LINES: 30,
};

class OperationEngine {
  constructor() {
    this.activeOperation = null; // currently running Operation object
    this.history = [];           // array of completed/failed/cancelled operations
    this.subscribers = new Map(); // opId -> Set<Response>
    this.loadHistory();
  }

  loadHistory() {
    try {
      const historyFile = path.join(os.homedir(), '.cache', 'aura', 'operation_history.json');
      if (fs.existsSync(historyFile)) {
        this.history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      }
    } catch {}
  }

  persistHistory() {
    try {
      const auraCache = path.join(os.homedir(), '.cache', 'aura');
      if (!fs.existsSync(auraCache)) fs.mkdirSync(auraCache, { recursive: true });
      fs.writeFileSync(
        path.join(auraCache, 'operation_history.json'),
        JSON.stringify(this.history.slice(0, LIMITS.MAX_HISTORY_ENTRIES), null, 2)
      );
    } catch {}
  }

  createOperation(pkg, action) {
    // Concurrency Guard: Block concurrent system-mutating operations.
    // Read-only operations (search, info, etc.) are unaffected.
    if (this.activeOperation && ['resolving', 'downloading', 'building', 'installing'].includes(this.activeOperation.state)) {
      const err = new Error(`Operation already active for ${this.activeOperation.pkg}`);
      err.code = 'CONCURRENT_OPERATION_RUNNING';
      err.activeOp = this.sanitizeOperation(this.activeOperation);
      throw err;
    }

    const id = `op_${Date.now()}_${pkg.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const op = {
      id,
      pkg,
      action, // 'install' | 'remove' | 'update'
      source: 'aura', // operation ownership: 'aura' | 'external'
      state: 'resolving',
      stage: 'resolving',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      pid: null,
      pgid: null,
      metrics: { speed: null, downloaded: null, percent: null },
      logs: [], // ring buffer of recent logs (enforced by LIMITS)
      logBytes: 0,
      error: null,
      child: null,
      verification: {
        status: 'pending', // pending | verified | not_verified | verification_failed | not_applicable
        method: null,
        verifiedAt: null,
        installedVersion: null,
      },
    };

    this.activeOperation = op;
    this.subscribers.set(id, new Set());
    return op;
  }

  sanitizeOperation(op) {
    if (!op) return null;
    return {
      id: op.id,
      pkg: op.pkg,
      action: op.action,
      source: op.source,
      state: op.state,
      stage: op.stage,
      startedAt: op.startedAt,
      updatedAt: op.updatedAt,
      completedAt: op.completedAt,
      metrics: op.metrics,
      logs: op.logs.slice(-50),
      error: op.error,
      verification: op.verification,
    };
  }

  broadcast(opId, type, data) {
    const clients = this.subscribers.get(opId);
    if (!clients) return;
    const payload = `data: ${JSON.stringify({ opId, type, data })}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch {}
    }
  }

  addSubscriber(opId, res) {
    if (!this.subscribers.has(opId)) {
      this.subscribers.set(opId, new Set());
    }
    this.subscribers.get(opId).add(res);

    res.on('close', () => {
      const set = this.subscribers.get(opId);
      if (set) {
        set.delete(res);
        if (set.size === 0 && (!this.activeOperation || this.activeOperation.id !== opId)) {
          this.subscribers.delete(opId);
        }
      }
    });
  }

  setState(opId, newState, extra = {}) {
    const op = this.activeOperation?.id === opId ? this.activeOperation : null;
    if (!op) return;

    op.state = newState;
    op.stage = newState;
    op.updatedAt = Date.now();
    if (extra.error) op.error = extra.error;

    this.broadcast(opId, 'state_change', {
      state: newState,
      stage: newState,
      pkg: op.pkg,
      ...extra,
    });
  }

  addLog(opId, text, type = 'log') {
    const op = this.activeOperation?.id === opId ? this.activeOperation : null;
    if (!op) return;

    const textBytes = Buffer.byteLength(text, 'utf8');

    // Enforce max log bytes per operation (prevent memory growth on large builds)
    if (op.logBytes + textBytes > LIMITS.MAX_LOG_BYTES) {
      // Evict oldest logs until under budget
      while (op.logs.length > 0 && op.logBytes + textBytes > LIMITS.MAX_LOG_BYTES) {
        const evicted = op.logs.shift();
        op.logBytes -= Buffer.byteLength(evicted.text, 'utf8');
      }
    }

    // Enforce max log lines
    while (op.logs.length >= LIMITS.MAX_LOG_LINES) {
      const evicted = op.logs.shift();
      op.logBytes -= Buffer.byteLength(evicted.text, 'utf8');
    }

    op.logs.push({ text, type, ts: Date.now() });
    op.logBytes += textBytes;
    this.broadcast(opId, 'log', text);
  }

  setMetrics(opId, metrics) {
    const op = this.activeOperation?.id === opId ? this.activeOperation : null;
    if (!op) return;

    op.metrics = { ...op.metrics, ...metrics };
    this.broadcast(opId, 'metrics', op.metrics);
  }

  async finishOperation(opId, finalStatus, error = null) {
    const op = this.activeOperation?.id === opId ? this.activeOperation : null;
    if (!op) return;

    op.state = finalStatus;
    op.stage = finalStatus;
    op.completedAt = Date.now();
    op.error = error;

    // Strict Verification Invariant:
    //   Install/Update: exit 0 AND pacman -Q finds package AND version matches
    //   Remove:         exit 0 AND pacman -Q no longer finds package
    //   Cancelled/Failed: not_applicable
    if (finalStatus === 'completed' && (op.action === 'install' || op.action === 'update')) {
      try {
        const { stdout } = await execAsync(`pacman -Q ${op.pkg} 2>/dev/null`);
        const parts = stdout.trim().split(' ');
        const installedVersion = parts[1] || null;
        op.verification = {
          status: installedVersion ? 'verified' : 'not_verified',
          method: 'pacman-query',
          verifiedAt: Date.now(),
          installedVersion,
        };
      } catch {
        op.verification = {
          status: 'verification_failed',
          method: 'pacman-query',
          verifiedAt: Date.now(),
          installedVersion: null,
        };
      }
    } else if (finalStatus === 'completed' && op.action === 'remove') {
      try {
        await execAsync(`pacman -Q ${op.pkg} 2>/dev/null`);
        // Package still found after removal → not verified
        op.verification = {
          status: 'not_verified',
          method: 'pacman-query-absent',
          verifiedAt: Date.now(),
          installedVersion: null,
        };
      } catch {
        // Package absent from system → verified removal
        op.verification = {
          status: 'verified',
          method: 'pacman-query-absent',
          verifiedAt: Date.now(),
          installedVersion: null,
        };
      }
    } else {
      op.verification = {
        status: 'not_applicable',
        method: null,
        verifiedAt: null,
        installedVersion: null,
      };
    }

    this.broadcast(opId, 'done', {
      status: finalStatus,
      error,
      verification: op.verification,
    });

    // Record in persistent history (trimmed logs for space efficiency)
    this.history.unshift({
      id: op.id,
      pkg: op.pkg,
      action: op.action,
      source: op.source,
      state: op.state,
      startedAt: op.startedAt,
      completedAt: op.completedAt,
      error: op.error,
      verification: op.verification,
    });
    this.history = this.history.slice(0, LIMITS.MAX_HISTORY_ENTRIES);
    this.persistHistory();

    // Auto-clean temporary AUR build tree if enabled in settings
    if (finalStatus === 'completed' && op.pkg) {
      try {
        const settings = getSettings();
        if (settings.autoCleanBuildCache) {
          cleanAurBuildCache(op.pkg);
        }
      } catch {}
    }

    this.activeOperation = null;
  }

  async cancelOperation(opId = null) {
    const op = (opId && this.activeOperation?.id === opId) || (!opId && this.activeOperation)
      ? this.activeOperation
      : null;

    if (!op || !op.child) {
      return { ok: false, error: 'No active operation to cancel' };
    }

    const pid = op.child.pid;
    try {
      // Tree-wide kill via negative PID
      process.kill(-pid, 'SIGTERM');
      this.addLog(op.id, '>> Installation cancelled by user. Terminating process tree…', 'warning');

      // Fallback SIGKILL after 1.5s grace period if still active
      setTimeout(() => {
        try { process.kill(-pid, 'SIGKILL'); } catch {}
      }, 1500);
    } catch {}

    await this.finishOperation(op.id, 'cancelled', {
      code: 'USER_CANCELLED',
      message: 'Operation was cancelled by user.',
      stage: op.stage,
      recoverable: true,
      suggestedAction: 'retry',
    });

    return { ok: true, cancelled: op.pkg, opId: op.id };
  }
}

const engine = new OperationEngine();

// ============================================================================
// 4. API Endpoints
// ============================================================================

// --- Active Operation & History Endpoints ---
app.get('/api/operations/active', (req, res) => {
  res.json({ activeOperation: engine.sanitizeOperation(engine.activeOperation) });
});

app.get('/api/operations/history', (req, res) => {
  res.json({ history: engine.history });
});

app.post('/api/cancel', async (req, res) => {
  const { opId } = req.body;
  const result = await engine.cancelOperation(opId);
  res.json(result);
});

// --- Crash Recovery & Stale Lock Check ---
app.get('/api/recovery', async (req, res) => {
  const lockFile = '/var/lib/pacman/db.lck';
  const hasLock = fs.existsSync(lockFile);
  let isLockStale = false;
  let runningProcesses = [];

  try {
    const { stdout } = await execAsync('pgrep -a -E "(pacman|paru|makepkg|yay)" 2>/dev/null').catch(() => ({ stdout: '' }));
    runningProcesses = stdout.trim().split('\n').filter(Boolean);
    // Explicit Guard: Only mark as stale if lock exists AND zero pacman processes exist
    if (hasLock && runningProcesses.length === 0) {
      isLockStale = true;
    }
  } catch {}

  res.json({
    hasLock,
    isLockStale,
    runningProcesses,
    message: hasLock
      ? (isLockStale
          ? 'Stale pacman database lock detected from an interrupted session.'
          : 'Package manager is currently active in another process.')
      : 'Pacman database is available.',
  });
});

// --- Safe Clean / Unlock Pacman Lock ---
app.post('/api/unlock', async (req, res) => {
  const lockFile = '/var/lib/pacman/db.lck';
  try {
    // Security Guard: Check if an active pacman process is running before deleting lock
    const { stdout } = await execAsync('pgrep -a -E "(pacman|paru|makepkg|yay)" 2>/dev/null').catch(() => ({ stdout: '' }));
    const running = stdout.trim().split('\n').filter(Boolean);

    if (running.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'PACMAN_ACTIVE',
        message: 'Cannot remove lock: a package manager process is currently running.',
        runningProcesses: running,
      });
    }

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

// --- Official Arch repos (core/extra/multilib, and any distro-added repos)
// via pacman's local sync databases, not a network API ---
app.get('/api/search/official', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.json({ results: [] });
  try {
    const results = await searchOfficialRepos(q);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/info/official', async (req, res) => {
  const { pkg } = req.query;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });
  try {
    const info = await getOfficialPackageInfo(pkg);
    res.json({ results: info ? [info] : [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Flathub (sandboxed apps) via Flathub's public REST API ---
app.get('/api/search/flathub', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 1) return res.json({ results: [] });
  try {
    const results = await searchFlathub(q);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/info/flathub', async (req, res) => {
  const { appId } = req.query;
  if (!appId) return res.status(400).json({ error: 'appId required' });
  try {
    const info = await getFlathubAppInfo(appId);
    res.json({ results: info ? [info] : [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Installed packages with real system Desktop Entry verification ---
app.get('/api/installed', async (req, res) => {
  try {
    const flatpakEntriesMap = getSystemDesktopEntries();

    const { stdout: aurPkgs } = await execAsync('pacman -Qm 2>/dev/null').catch(() => ({ stdout: '' }));
    const { stdout: allPkgs } = await execAsync('pacman -Q 2>/dev/null').catch(() => ({ stdout: '' }));
    const { stdout: flatpakApps } = await execFileAsync('flatpak', ['list', '--app', '--columns=application']).catch(() => ({ stdout: '' }));

    const aur = [];
    for (const l of aurPkgs.trim().split('\n').filter(Boolean)) {
      const [name, version] = l.split(' ');

      let entries = await getPacmanOwnedDesktopFiles(name);
      if (entries.length === 0) {
        // Fallback for flatpak-installed apps, which pacman doesn't own files for.
        const cleanKey = name.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
        entries = flatpakEntriesMap.get(cleanKey) || flatpakEntriesMap.get(name.toLowerCase()) || [];
      }

      const guiEntries = entries.filter(e => e.isGui);
      const isLaunchable = guiEntries.length > 0;

      aur.push({
        name,
        version,
        source: 'aur',
        isLaunchable,
        desktopFile: guiEntries[0]?.filename || null,
        icon: guiEntries[0]?.icon || null,
        desktopEntries: guiEntries,
      });
    }

    const allSet = new Set(allPkgs.trim().split('\n').filter(Boolean).map(l => l.split(' ')[0]));
    for (const appId of flatpakApps.trim().split('\n').filter(Boolean)) allSet.add(appId);
    res.json({ aur, allInstalled: [...allSet] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Updates available ---
function parseUpdateLines(stdout, source) {
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    return { name: parts[0], current: parts[1], latest: parts[3], source };
  });
}

function parseSizeToBytes(str) {
  const m = str.trim().match(/^([\d.]+)\s*(B|KiB|MiB|GiB|TiB)$/i);
  if (!m) return null;
  const mult = { B: 1, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4 }[m[2].toUpperCase()];
  return Math.round(parseFloat(m[1]) * mult);
}

// Download/installed sizes only exist for official-repo packages (pacman -Si).
// AUR packages are built from source — there's no fixed download size to report.
async function getOfficialSizes(names) {
  if (names.length === 0) return {};
  const { stdout } = await execFileAsync('pacman', ['-Si', ...names]).catch(() => ({ stdout: '' }));
  const sizes = {};
  for (const block of stdout.split(/\n\n+/)) {
    const nameMatch = block.match(/^Name\s*:\s*(.+)$/m);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    // A package can exist in multiple repos (e.g. cachyos + extra); pacman -Si
    // lists them in repo-priority order, so keep only the first (winning) match.
    if (sizes[name]) continue;
    const dl = block.match(/^Download Size\s*:\s*(.+)$/m);
    const inst = block.match(/^Installed Size\s*:\s*(.+)$/m);
    sizes[name] = {
      downloadSize: dl ? parseSizeToBytes(dl[1]) : null,
      installSize: inst ? parseSizeToBytes(inst[1]) : null,
    };
  }
  return sizes;
}

app.get('/api/updates', async (req, res) => {
  try {
    // AUR updates: paru -Qua hits the AUR RPC live, no sync-db freshness needed.
    // Official-repo updates: checkupdates (pacman-contrib) syncs its own temp copy
    // of the sync db without sudo, unlike `paru -Qu`/`pacman -Qu` which only compare
    // against the last-synced local cache and silently miss updates if it's stale.
    const [aurRes, officialRes] = await Promise.all([
      execAsync('paru -Qua 2>/dev/null').catch(() => ({ stdout: '' })),
      execAsync('checkupdates 2>/dev/null').catch(() => ({ stdout: '' })),
    ]);
    const aurUpdates = parseUpdateLines(aurRes.stdout, 'aur');
    const officialUpdates = parseUpdateLines(officialRes.stdout, 'official');

    const sizes = await getOfficialSizes(officialUpdates.map(u => u.name));
    officialUpdates.forEach(u => {
      const s = sizes[u.name];
      u.downloadSize = s?.downloadSize ?? null;
      u.installSize = s?.installSize ?? null;
    });

    res.json({ updates: [...aurUpdates, ...officialUpdates] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Live Install / Update / Remove via SSE (Authoritative Operation Stream) ---
app.get('/api/install', async (req, res) => {
  const { pkg, action = 'install', opId, source } = req.query;

  // Reconnection path: Client reconnecting to existing operation
  if (opId && engine.activeOperation && engine.activeOperation.id === opId) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    engine.addSubscriber(opId, res);

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({
      opId,
      type: 'state_change',
      data: {
        state: engine.activeOperation.state,
        stage: engine.activeOperation.stage,
        pkg: engine.activeOperation.pkg,
        metrics: engine.activeOperation.metrics,
      }
    })}\n\n`);

    for (const log of engine.activeOperation.logs.slice(-LIMITS.MAX_RECONNECT_REPLAY_LINES)) {
      res.write(`data: ${JSON.stringify({ opId, type: 'log', data: log.text })}\n\n`);
    }
    return;
  }

  if (!pkg) return res.status(400).send('pkg required');

  let op;
  try {
    op = engine.createOperation(pkg, action);
  } catch (err) {
    if (err.code === 'CONCURRENT_OPERATION_RUNNING') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({
        type: 'error',
        data: {
          code: 'CONCURRENT_OPERATION_RUNNING',
          message: `Another operation is currently in progress for ${err.activeOp.pkg}.`,
          activeOp: err.activeOp,
          recoverable: false,
          suggestedAction: 'wait',
        }
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', data: { status: 'error' } })}\n\n`);
      return res.end();
    }
    return res.status(500).json({ error: err.message });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  engine.addSubscriber(op.id, res);
  engine.setState(op.id, 'resolving');

  // Pre-check and auto-link manual download sources
  if (action === 'install' && source !== 'flathub') {
    autoLinkDownloadSources(pkg);
  }

  op.pkgSource = source === 'flathub' ? 'flathub' : 'aur';

  let cmd, args;
  if (source === 'flathub') {
    const scope = await getFlathubInstallScope();
    if (!scope) {
      await engine.finishOperation(op.id, 'failed', {
        code: 'FLATHUB_NOT_CONFIGURED',
        message: 'Flathub is not set up on this system. Add it with "flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo".',
        stage: 'resolving',
        recoverable: false,
        suggestedAction: 'show_logs',
      });
      return res.end();
    }
    ({ cmd, args } = buildFlathubCommand(action, scope, pkg));
  } else if (action === 'remove') {
    cmd = 'pkexec';
    args = ['pacman', '-R', '--noconfirm', pkg];
  } else {
    cmd = 'paru';
    // --skipreview: paru shows an interactive PKGBUILD review/diff prompt
    // whenever a recipe changed since it was last built — which is every
    // update, not just fresh installs. --noconfirm alone doesn't suppress
    // it (it's a separate prompt from the install confirmation), so a
    // non-interactive spawn (no TTY) just hangs on stdin until it times out
    // or fails. Aura already shows the PKGBUILD in-app before install
    // (Build Transparency section), so paru's own review step is redundant
    // here anyway.
    args = ['-S', '--noconfirm', '--skipreview', '--noprogressbar', '--color', 'never', '--sudoflags', '-A', pkg];
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

  op.child = child;
  op.pid = child.pid;

  let detectedError = null;

  const handleOutput = (d) => {
    const text = d.toString();
    engine.addLog(op.id, text);

    // State machine transitions derived from real process output
    if (text.includes('Downloading') || text.includes('Retrieving sources') || text.includes('curl') || text.includes('PKGBUILDs up to date')) {
      if (op.state !== 'downloading') engine.setState(op.id, 'downloading');

      // Extract real measured transfer metrics if present
      const speedMatch = text.match(/([\d.]+\s*(?:MB\/s|MiB\/s|kB\/s|KB\/s|GB\/s))/i);
      const sizeMatch = text.match(/([\d.]+[MGK]i?B?)\s+(?:of|\/)\s+([\d.]+[MGK]i?B?)/i);
      const percentMatch = text.match(/(\d{1,3})%/);

      if (speedMatch || sizeMatch || percentMatch) {
        engine.setMetrics(op.id, {
          speed: speedMatch ? speedMatch[1] : null,
          downloaded: sizeMatch ? `${sizeMatch[1]} / ${sizeMatch[2]}` : null,
          percent: percentMatch ? parseInt(percentMatch[1], 10) : null,
        });
      }
    } else if (text.includes('Making package') || text.includes('Starting build') || text.includes('Compiling') || text.includes('gcc') || text.includes('ninja') || text.includes('cargo')) {
      if (op.state !== 'building') engine.setState(op.id, 'building');
    } else if (text.includes('Installing') || text.includes('pacman -U') || text.includes('Starting package()') || text.includes('authenticat')) {
      if (op.state !== 'installing') engine.setState(op.id, 'installing');
    }

    // Standardized Error Pattern Matching
    if (text.includes('was not found in the build directory and is not a URL')) {
      const match = text.match(/ERROR:\s*([^\s]+)\s*was not found/i);
      detectedError = {
        code: 'SOURCE_MISSING_MANUAL_DOWNLOAD',
        message: 'This package requires a source file that cannot be downloaded automatically.',
        filename: match ? match[1] : 'source package',
        stage: 'downloading',
        recoverable: true,
        suggestedAction: 'open_downloads',
      };
      if (match) autoLinkDownloadSources(pkg, match[1]);
    } else if (text.includes('unable to lock database') || text.includes('db.lck')) {
      detectedError = {
        code: 'PACMAN_LOCKED',
        message: 'Pacman database is currently locked by another process.',
        details: '/var/lib/pacman/db.lck exists',
        stage: 'resolving',
        recoverable: true,
        suggestedAction: 'clean_lock',
      };
    } else if (text.includes('failed to resolve dependencies') || text.includes('could not satisfy dependencies')) {
      detectedError = {
        code: 'DEPENDENCY_UNRESOLVED',
        message: 'Required dependencies could not be resolved in AUR or official repos.',
        details: text.trim(),
        stage: 'resolving',
        recoverable: false,
        suggestedAction: 'show_logs',
      };
    } else if (text.includes('password incorrect') || text.includes('authentication failed')) {
      cachedSudoPassword = null;
      detectedError = {
        code: 'AUTH_FAILED',
        message: 'Root authentication was cancelled or failed.',
        stage: 'installing',
        recoverable: true,
        suggestedAction: 'retry_sudo',
      };
    } else if (text.includes('packages failed to build') || text.includes('failed in build()')) {
      if (!detectedError) {
        detectedError = {
          code: 'BUILD_FAILED',
          message: 'The package failed during the makepkg compilation process.',
          details: text.trim(),
          stage: 'building',
          recoverable: true,
          suggestedAction: 'show_logs',
        };
      }
    } else if (text.includes('already exists and is not an empty directory')) {
      detectedError = {
        code: 'STALE_BUILD_CACHE',
        message: 'A leftover build folder from a previous interrupted install is blocking this package.',
        details: text.trim(),
        stage: 'downloading',
        recoverable: true,
        suggestedAction: 'clean_build_cache',
      };
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('close', async (code) => {
    if (code === 0) {
      await engine.finishOperation(op.id, 'completed');
    } else {
      await engine.finishOperation(op.id, 'failed', detectedError);
    }
    res.end();
  });

  child.on('error', async (err) => {
    await engine.finishOperation(op.id, 'failed', {
      code: 'EXEC_ERROR',
      message: err.message,
      stage: op.stage,
      recoverable: false,
      suggestedAction: 'show_logs',
    });
    res.end();
  });
});

// --- Open Downloads Folder ---
app.post('/api/open-downloads', (req, res) => {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const child = spawn('xdg-open', [downloadsDir], { detached: true, stdio: 'ignore' });
  child.unref();
  res.json({ ok: true });
});

// --- Launch installed app (optionally a specific Desktop Action) ---
app.post('/api/launch', async (req, res) => {
  const { pkg, desktopFile, actionId } = req.body;
  if (!pkg) return res.status(400).json({ error: 'pkg required' });

  let entries = await getPacmanOwnedDesktopFiles(pkg);
  if (entries.length === 0) {
    const flatpakEntriesMap = getSystemDesktopEntries();
    const cleanKey = pkg.toLowerCase().replace(/-(?:bin|git|desktop|electron|app)$/, '');
    entries = flatpakEntriesMap.get(cleanKey) || flatpakEntriesMap.get(pkg.toLowerCase()) || [];
  }

  const entry = (desktopFile && entries.find(e => e.filename === desktopFile)) || entries[0];
  const target = entry?.filename || desktopFile || pkg.replace(/-(?:bin|git)$/, '');

  if (actionId) {
    const action = entry?.actions?.find(a => a.id === actionId);
    const absolutePath = entry?.path;

    const runFallback = () => {
      if (!action?.exec) return;
      try {
        const [cmd, ...args] = stripFieldCodes(action.exec).split(' ').filter(Boolean);
        const fallback = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        fallback.unref();
      } catch {}
    };

    if (absolutePath) {
      const child = spawn('gio', ['launch', absolutePath, actionId], { detached: true, stdio: 'ignore' });
      child.unref();
      child.on('error', runFallback);
    } else {
      runFallback();
    }

    return res.json({ ok: true, launched: target, action: actionId });
  }

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

// --- System Icon Streaming from XDG Theme ---
app.get('/api/icon', (req, res) => {
  const { name, pkg } = req.query;
  if (!name && !pkg) {
    return res.status(400).json({ error: 'name or pkg parameter required' });
  }

  const iconPath = findSystemIconPath(name, pkg);
  if (!iconPath) {
    return res.status(404).json({ error: 'Icon not found on system' });
  }

  const mimeType = getIconMimeType(iconPath);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(iconPath).pipe(res);
});

// --- In-App Sudo Askpass Bridge Endpoints ---
const pendingAuthRequests = new Map();

// Each batch update spawns a separate `paru -S` process per package (detached,
// with its own session for clean tree-kill on Cancel), so sudo's own tty/session
// timestamp cache never carries over between them — every package would re-prompt
// for the password otherwise. Cache the validated password here instead, in
// memory only, for a short window matching sudo's own default timestamp_timeout,
// so a batch of hundreds of updates only asks once.
const SUDO_CACHE_TTL_MS = 15 * 60 * 1000;
let cachedSudoPassword = null;
let cachedSudoPasswordAt = 0;

app.post('/api/auth/askpass', (req, res) => {
  const { prompt } = req.body || {};

  if (cachedSudoPassword && Date.now() - cachedSudoPasswordAt < SUDO_CACHE_TTL_MS) {
    res.json({ password: cachedSudoPassword });
    return;
  }

  const authId = 'auth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const opId = engine.activeOperation?.id || null;

  // 60-second timeout waiting for user response in frontend
  const timer = setTimeout(() => {
    if (pendingAuthRequests.has(authId)) {
      pendingAuthRequests.delete(authId);
      try {
        res.status(408).json({ error: 'Authentication request timed out' });
      } catch {}
    }
  }, 60000);

  pendingAuthRequests.set(authId, { res, timer, opId, createdAt: Date.now() });

  // Broadcast auth_required event to frontend via SSE
  if (opId) {
    engine.broadcast(opId, 'auth_required', {
      authId,
      prompt: prompt || 'Aura requires administrator privileges to proceed.',
      pkg: engine.activeOperation?.pkg,
    });
  }
});

app.post('/api/auth/respond', (req, res) => {
  const { authId, password, cancelled } = req.body || {};
  if (!authId || !pendingAuthRequests.has(authId)) {
    return res.status(404).json({ error: 'Authentication request expired or not found' });
  }

  const authReq = pendingAuthRequests.get(authId);
  clearTimeout(authReq.timer);
  pendingAuthRequests.delete(authId);

  if (cancelled) {
    try {
      authReq.res.status(401).json({ error: 'User cancelled authentication' });
    } catch {}
    return res.json({ ok: true, cancelled: true });
  }

  if (password === undefined || password === null) {
    try {
      authReq.res.status(400).json({ error: 'Password required' });
    } catch {}
    return res.status(400).json({ error: 'Password required' });
  }

  cachedSudoPassword = password;
  cachedSudoPasswordAt = Date.now();

  try {
    authReq.res.json({ password });
  } catch {}

  res.json({ ok: true });
});

// --- System Storage & Maintenance Endpoints ---
app.get('/api/system/storage', async (req, res) => {
  try {
    const metrics = await getStorageMetrics();
    res.json(metrics);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/system/clean-cache', async (req, res) => {
  const { target, pkg } = req.body || {};
  let aurResult = { freedBytes: 0, deletedCount: 0 };
  let pacmanResult = { ok: true, message: '' };

  if (!target || target === 'aur' || target === 'all') {
    aurResult = cleanAurBuildCache(pkg || null);
  }

  if (target === 'pacman' || target === 'all') {
    try {
      await execAsync('paccache -rk1 2>/dev/null || pacman -Sc --noconfirm 2>/dev/null').catch(() => {});
      pacmanResult = { ok: true, message: 'Pacman cache pruned' };
    } catch (e) {
      pacmanResult = { ok: false, error: e.message };
    }
  }

  const updated = await getStorageMetrics();
  res.json({
    ok: true,
    aur: aurResult,
    pacman: pacmanResult,
    storage: updated,
  });
});

app.post('/api/system/clean-orphans', async (req, res) => {
  const { pkgs } = req.body || {};
  try {
    let pkgList = pkgs;
    if (!pkgList || pkgList.length === 0) {
      const { stdout } = await execAsync('pacman -Qtdq 2>/dev/null').catch(() => ({ stdout: '' }));
      pkgList = stdout.trim().split('\n').filter(Boolean);
    }

    if (pkgList.length === 0) {
      return res.json({ ok: true, removed: [], message: 'No orphan packages to remove' });
    }

    const cmd = `pacman -Rns --noconfirm ${pkgList.join(' ')}`;
    await execAsync(cmd);
    const updatedOrphans = await getOrphanPackages();
    res.json({ ok: true, removed: pkgList, remainingOrphans: updatedOrphans });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- Persistent User Settings Endpoints ---
app.get('/api/settings', (req, res) => {
  res.json({ settings: getSettings() });
});

app.post('/api/settings', (req, res) => {
  const result = saveSettings(req.body || {});
  res.json(result);
});

// --- Production Frontend Static Serving (Unified Runtime) ---
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Aura Store backend running on http://localhost:${PORT}`);
});
