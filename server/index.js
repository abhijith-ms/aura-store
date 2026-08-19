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

// ============================================================================
// 1. System Desktop Entry Indexer (Multi-Entry Support)
// ============================================================================
function getSystemDesktopEntries() {
  const dirs = [
    '/usr/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
  ];

  const entriesMap = new Map(); // baseKey -> Array<{ filename, name, exec, isGui }>

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

// --- Live Install / Update / Remove via SSE (Authoritative Operation Stream) ---
app.get('/api/install', async (req, res) => {
  const { pkg, action = 'install', opId } = req.query;

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
