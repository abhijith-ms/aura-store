import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Check, X, AlertTriangle, Info, History, Ban, ChevronUp, ChevronDown,
  ExternalLink, Package, Sparkles, ArrowRight, RotateCcw, Lock, SearchX,
  Hourglass, Search,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import PackageDetail from './components/PackageDetail';
import TerminalDrawer from './components/TerminalDrawer';
import TopProgressBar from './components/TopProgressBar';
import AppIcon from './components/AppIcon';
import CommandPalette from './components/search/CommandPalette';
import AuthModal from './components/AuthModal';
import SettingsTab from './components/SettingsTab';
import { ThemeProvider } from './context/ThemeContext';
import {
  searchPackages, getInstalled, getUpdates, getPackageInfo, getMultiplePackageInfo,
  streamInstall, launchApp, cancelInstall, checkRecovery, unlockPacman,
  getActiveOperation, getServerOperationHistory, submitAuthResponse,
  getOperationHistory, addOperationHistory, isLaunchable, CATEGORIES, getAppDisplayName,
  formatNumber, timeAgo, KNOWN_DISPLAY_NAMES, getAppSettings
} from './services/aurApi';
import { normalizeQuery } from './services/search/normalizeQuery';
import { rankPackages } from './services/search/rankPackages';
import { searchCache } from './services/search/searchCache';
import { fetchSearchCandidates } from './services/search/fetchSearchCandidates';
import { diffNewlyAvailableUpdates, formatUpdateNotificationBody } from './services/updateNotifier';

// Top curated candidates for Explore discovery (dynamically sorted by popularity/votes)
const DISCOVERY_POPULAR_CANDIDATES = [
  'visual-studio-code-bin',
  'spotify',
  'zen-browser-bin',
  'google-chrome',
  'brave-bin',
  'discord',
  'steam',
  'obs-studio-git',
];

const DISCOVERY_ESSENTIAL_CANDIDATES = [
  'paru',
  'fastfetch-git',
  'btop',
  'alacritty-git',
  'timeshift',
  'kitty-git',
];

// ---------- Toast Notifications ----------
function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{ display: 'inline-flex' }}>
            {t.type === 'success' ? <Check size={15} strokeWidth={2.5} /> : t.type === 'error' ? <X size={15} strokeWidth={2.5} /> : t.type === 'warning' ? <AlertTriangle size={15} strokeWidth={2} /> : <Info size={15} strokeWidth={2} />}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Loading Skeleton Grid ----------
function SkeletonGrid({ count = 4, popular = false }) {
  return (
    <div className={`app-grid ${popular ? 'popular-grid' : ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skeleton-box" style={{ width: 42, height: 42, borderRadius: 8 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-box" style={{ height: 14, width: '60%' }} />
              <div className="skeleton-box" style={{ height: 10, width: '40%' }} />
            </div>
          </div>
          <div className="skeleton-box" style={{ height: 28, width: '100%', marginTop: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <div className="skeleton-box" style={{ height: 12, width: '35%' }} />
            <div className="skeleton-box" style={{ height: 24, width: 55, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Activity History View (Lightweight & Operational) ----------
function ActivityTab({ history, onSelectPkg, onClearHistory }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!history || history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><History size={26} strokeWidth={1.75} /></div>
        <div className="empty-title">No recent activity</div>
        <div className="empty-desc">Completed, failed, and cancelled package operations will be logged here.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="section-title">Recent Activity</div>
          <div className="section-count">{history.length} operations recorded</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClearHistory}>
          Clear History
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map(item => {
          const displayName = getAppDisplayName(item.pkg);
          const isDone = item.state === 'completed' || item.status === 'completed';
          const isCancelled = item.state === 'cancelled' || item.status === 'cancelled';
          const isExpanded = expandedId === item.id;
          const timeLabel = item.startedAt ? timeAgo(item.startedAt / 1000) : (item.timestamp ? timeAgo(new Date(item.timestamp).getTime() / 1000) : 'recently');

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <AppIcon pkgName={item.pkg} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{displayName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.pkg}</span>
                    {item.verification?.status === 'verified' && <span className="chip chip-green" style={{ fontSize: 10, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={9} strokeWidth={2.5} /> Verified</span>}
                    {item.verification?.status === 'not_verified' && <span className="chip chip-red" style={{ fontSize: 10, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><X size={9} strokeWidth={2.5} /> Not Verified</span>}
                    {item.verification?.status === 'verification_failed' && <span className="chip chip-red" style={{ fontSize: 10, padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={9} strokeWidth={2} /> Verification Failed</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {item.action === 'remove' ? 'Removed package' : item.action === 'update' ? 'Updated package' : 'Installed package'} · {timeLabel}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isDone ? (
                    <span className="chip chip-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={2.5} /> Completed</span>
                  ) : isCancelled ? (
                    <span className="chip chip-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ban size={11} strokeWidth={2} /> Cancelled</span>
                  ) : (
                    <span className="chip chip-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={11} strokeWidth={2.5} /> Failed</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex' }}>{isExpanded ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
                </div>
              </div>

              {/* Collapsible Details / Error Breakdown */}
              {isExpanded && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--surface-hover)',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Operation ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{item.id}</code></span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 11 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPkg({ Name: item.pkg, Description: 'AUR Package' });
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>View Package <ExternalLink size={12} strokeWidth={2} /></span>
                    </button>
                  </div>

                  {item.verification && item.verification.status !== 'not_applicable' && (
                    <div style={{
                      padding: 8,
                      background: item.verification.status === 'verified' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${item.verification.status === 'verified' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      borderRadius: 4,
                      color: item.verification.status === 'verified' ? 'var(--success)' : 'var(--danger)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      fontSize: 11.5,
                    }}>
                      <span style={{ fontWeight: 600 }}>
                        {item.verification.status === 'verified' ? <><Check size={12} strokeWidth={2.5} /> Verified</> : item.verification.status === 'not_verified' ? <><X size={12} strokeWidth={2.5} /> Not Verified</> : <><AlertTriangle size={12} strokeWidth={2} /> Verification Failed</>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        method: {item.verification.method}
                        {item.verification.installedVersion && ` · v${item.verification.installedVersion}`}
                      </span>
                    </div>
                  )}

                  {item.error && (
                    <div style={{
                      padding: 8,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 4,
                      color: 'var(--danger)',
                    }}>
                      <div style={{ fontWeight: 600 }}>{item.error.code || 'Error'}: {item.error.message}</div>
                      {item.error.details && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4, opacity: 0.85 }}>{item.error.details}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Installed Library View ----------
function InstalledTab({ packages, onSelect, onLaunch, addToast }) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return packages;
    const q = filter.toLowerCase().trim();
    return packages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      getAppDisplayName(p.name).toLowerCase().includes(q)
    );
  }, [packages, filter]);

  if (packages.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Package size={26} strokeWidth={1.75} /></div>
        <div className="empty-title">No installed packages</div>
        <div className="empty-desc">Packages you install from the AUR will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title">Installed Applications</div>
          <div className="section-count">{packages.length} AUR packages installed</div>
        </div>

        <div style={{ width: 220 }}>
          <input
            type="text"
            className="search-input"
            style={{ padding: '5px 10px', fontSize: 12 }}
            placeholder="Filter installed…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 28 }}>
          <div className="empty-title">No matching installed packages</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(pkg => {
            const displayName = getAppDisplayName(pkg.name);
            const canLaunch = pkg.isLaunchable ?? isLaunchable(pkg.name);

            return (
              <div
                key={pkg.name}
                onClick={() => onSelect({ Name: pkg.name, Version: pkg.version, Description: 'Locally installed AUR package' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.background = 'var(--surface-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--surface)'; }}
              >
                <AppIcon pkgName={pkg.name} size="sm" installed={true} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {pkg.name} · v{pkg.version}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  {canLaunch && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onLaunch(pkg.name, displayName, pkg.desktopFile)}
                      title={`Launch ${displayName}`}
                    >
                      Open
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onSelect({ Name: pkg.name, Version: pkg.version, Description: 'Locally installed AUR package' })}
                    title="View package details"
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Updates View (with Selectable Batch Execution) ----------
function UpdatesTab({
  updates,
  onUpdateSingle,
  onUpdateBatch,
  onShowLogs,
  batchActive,
  batchIndex,
  batchList,
  pkgStatusMap,
}) {
  const [selected, setSelected] = useState(() => new Set(updates.map(u => u.name)));

  useEffect(() => {
    setSelected(new Set(updates.map(u => u.name)));
  }, [updates]);

  const toggleSelect = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === updates.length) setSelected(new Set());
    else setSelected(new Set(updates.map(u => u.name)));
  };

  if (updates.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Sparkles size={26} strokeWidth={1.75} /></div>
        <div className="empty-title">You're up to date</div>
        <div className="empty-desc">No AUR package updates are currently available.</div>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div>
      <div className="section-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div className="section-title">Available Updates</div>
          <div className="section-count">{updates.length} updates available</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={selectAll} disabled={batchActive}>
            {selected.size === updates.length ? 'Deselect All' : 'Select All'}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onUpdateBatch([...selected])}
            disabled={batchActive || selectedCount === 0}
            style={{ gap: 6, padding: '6px 14px' }}
          >
            {batchActive ? (
              <>
                <div className="spinner-apple" />
                <span>Updating ({batchIndex + 1}/{batchList.length})…</span>
              </>
            ) : (
              <span>Update Selected ({selectedCount})</span>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {updates.map(u => {
          const status = pkgStatusMap[u.name] || 'idle';
          const isChecked = selected.has(u.name);
          const displayName = getAppDisplayName(u.name);

          return (
            <div
              key={u.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSelect(u.name)}
                disabled={batchActive}
                style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />

              <AppIcon pkgName={u.name} size="sm" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{displayName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {u.name}: <span style={{ color: 'var(--text-muted)' }}>{u.current}</span> <ArrowRight size={11} strokeWidth={2} style={{ verticalAlign: 'middle' }} /> <span style={{ color: 'var(--success)', fontWeight: 600 }}>{u.latest}</span>
                </div>
              </div>

              {/* Status Indicator */}
              {status === 'updating' ? (
                <span className="chip chip-indigo" style={{ padding: '4px 8px', gap: 5 }}>
                  <div className="spinner-apple" /> Building…
                </span>
              ) : status === 'done' ? (
                <span className="chip chip-green" style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} strokeWidth={2.5} /> Updated</span>
              ) : status === 'failed' ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="chip chip-red" style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} strokeWidth={2.5} /> Failed</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onShowLogs}
                    title="View failure build logs"
                  >
                    View Logs
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onUpdateSingle(u.name)}
                    disabled={batchActive}
                    title="Retry updating this package"
                  >
                    Retry
                  </button>
                </div>
              ) : status === 'waiting' ? (
                <span className="chip chip-gray" style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Hourglass size={12} strokeWidth={2} /> Queued</span>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onUpdateSingle(u.name)}
                  disabled={batchActive}
                >
                  Update
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Main App Content ----------
function MainApp() {
  const [view, setView] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    const validViews = ['explore', 'installed', 'updates', 'activity', 'settings'];
    return validViews.includes(requested) ? requested : 'explore';
  });
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-desc');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [pkgStack, setPkgStack] = useState([]);
  const [installed, setInstalled] = useState(new Set());
  const [aurInstalled, setAurInstalled] = useState([]);
  const installedInfoMap = useMemo(
    () => new Map(aurInstalled.map((p) => [p.name, p])),
    [aurInstalled]
  );
  const [updates, setUpdates] = useState([]);
  const [popularPkgs, setPopularPkgs] = useState([]);
  const [essentialPkgs, setEssentialPkgs] = useState([]);
  const [categoryPkgs, setCategoryPkgs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState(() => getOperationHistory());

  // Stale Lock / Crash Recovery Status
  const [lockStatus, setLockStatus] = useState({ hasLock: false, isLockStale: false, message: '' });

  // Active Operation State (Authoritative model from backend)
  const [activeOpId, setActiveOpId] = useState(null);
  const [activePkg, setActivePkg] = useState('');
  const [activeAction, setActiveAction] = useState('install');
  const [isProcessing, setIsProcessing] = useState(false);
  const [opState, setOpState] = useState('idle');
  const [metrics, setMetrics] = useState({});
  const [lastError, setLastError] = useState(null);
  const [termLogs, setTermLogs] = useState([]);
  const [termOpen, setTermOpen] = useState(false);

  // Batch Update Queue State
  const [batchActive, setBatchActive] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchList, setBatchList] = useState([]);
  const [pkgStatusMap, setPkgStatusMap] = useState({});

  // Recent Searches State
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem('aura_recent_searches_v1');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [authRequest, setAuthRequest] = useState(null);

  const addRecentSearch = useCallback((q) => {
    if (!q || q.trim().length < 2) return;
    const clean = q.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== clean.toLowerCase());
      const next = [clean, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('aura_recent_searches_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Tracks the last-known set of update package names so we only notify
  // about ones that appeared *while the app was running* — not ones that
  // were already there at launch (the sidebar badge already shows those).
  // null until the first successful check establishes a baseline.
  const updateNotifyBaselineRef = useRef(null);

  const checkForUpdates = useCallback(async () => {
    try {
      const { updates: freshUpdates } = await getUpdates();

      const newlyAvailable = diffNewlyAvailableUpdates(updateNotifyBaselineRef.current, freshUpdates);
      if (newlyAvailable.length > 0 && typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') {
          new Notification('Aura Store', {
            body: formatUpdateNotificationBody(newlyAvailable),
            icon: '/favicon.png',
          });
        }
      }
      updateNotifyBaselineRef.current = new Set((freshUpdates || []).map(u => u.name));
      setUpdates(freshUpdates || []);
    } catch {}
  }, []);

  // Refresh package metadata
  const refreshPackages = useCallback(() => {
    getInstalled().then(({ aur, allInstalled }) => {
      setInstalled(new Set(allInstalled));
      setAurInstalled(aur || []);
    }).catch(() => {});
    checkForUpdates();
  }, [checkForUpdates]);

  // Periodic background update check, gated by the "Auto-Check for Updates"
  // setting. Manual refreshes (refreshPackages, called after installs/removes
  // and via the header Refresh button) always run regardless of this setting
  // — it only controls the silent timer-driven check.
  useEffect(() => {
    const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    const timer = setInterval(async () => {
      const { autoCheckUpdates } = await getAppSettings().catch(() => ({ autoCheckUpdates: true }));
      if (autoCheckUpdates === false) return;
      checkForUpdates();
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkForUpdates]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Startup Recovery & Reconnection Check
  useEffect(() => {
    refreshPackages();

    // 1. Check for crash recovery / lock status
    checkRecovery().then((res) => {
      setLockStatus(res);
      if (res.isLockStale) {
        addToast('Stale database lock detected from an interrupted operation.', 'warning');
      } else if (res.hasLock && !res.isLockStale) {
        addToast('Pacman database is currently active in another process.', 'warning');
      }
    });

    // 2. Check for active running operation on backend (e.g. after page refresh)
    getActiveOperation().then(({ activeOperation }) => {
      if (activeOperation && ['resolving', 'downloading', 'building', 'installing'].includes(activeOperation.state)) {
        setActiveOpId(activeOperation.id);
        setActivePkg(activeOperation.pkg);
        setActiveAction(activeOperation.action);
        setIsProcessing(true);
        setOpState(activeOperation.state);
        setMetrics(activeOperation.metrics || {});
        setTermLogs(activeOperation.logs || []);
        addToast(`Reconnected to active ${activeOperation.action} for ${activeOperation.pkg}`, 'info');

        // Re-subscribe to live SSE stream
        streamInstall(activeOperation.pkg, activeOperation.action, {
          opId: activeOperation.id,
          onLog: (log, type) => setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]),
          onAuthRequired: (data) => setAuthRequest(data),
          onStateChange: (event) => {
            setOpState(event.state);
            if (event.error) setLastError(event.error);
          },
          onMetrics: (m) => setMetrics(m),
          onDone: (ok, error, finalStatus) => {
            setIsProcessing(false);
            setAuthRequest(null);
            const status = finalStatus || (ok ? 'completed' : 'failed');
            setOpState(status);
            setActiveOpId(null);
            refreshPackages();
            getServerOperationHistory().then(({ history: h }) => setHistory(h || []));
          },
        });
      }
    });

    // 3. Load authoritative server operation history
    getServerOperationHistory().then(({ history: h }) => {
      if (h && h.length > 0) setHistory(h);
    });

    getMultiplePackageInfo(DISCOVERY_POPULAR_CANDIDATES).then(pkgs => {
      const sorted = [...pkgs].sort((a, b) => (b.NumVotes || 0) - (a.NumVotes || 0));
      setPopularPkgs(sorted.slice(0, 4));
    });
    getMultiplePackageInfo(DISCOVERY_ESSENTIAL_CANDIDATES).then(pkgs => {
      const sorted = [...pkgs].sort((a, b) => (b.NumVotes || 0) - (a.NumVotes || 0));
      setEssentialPkgs(sorted.slice(0, 4));
    });
  }, [refreshPackages, addToast]);

  // Global Keyboard Shortcuts (Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (pkgStack.length > 0) {
          const prev = pkgStack[pkgStack.length - 1];
          setPkgStack(s => s.slice(0, -1));
          setSelectedPkg(prev);
        } else if (selectedPkg) {
          setSelectedPkg(null);
        } else if (query) {
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, selectedPkg, pkgStack, query]);

  // Category packages load
  useEffect(() => {
    const activeCategory = CATEGORIES.find(c => c.id === view);
    if (activeCategory) {
      setLoading(true);
      getMultiplePackageInfo(activeCategory.packages).then(pkgs => {
        setCategoryPkgs(pkgs);
        setLoading(false);
      });
    }
  }, [view]);

  // Deterministic Debounced Search (500ms, Cache, Lexicographical Ranking, AbortController)
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const thisRequestId = ++requestIdRef.current;
    const normalizedKey = normalizeQuery(trimmed).normalizedQuery;

    searchTimer.current = setTimeout(async () => {
      const startTime = performance.now();
      setLoading(true);

      // 1. Check local search cache for raw candidate packages
      let candidates = searchCache.get(normalizedKey);
      let cacheHit = false;

      if (candidates) {
        cacheHit = true;
      } else {
        // 2. Fetch candidates from AUR RPC if cache miss
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          candidates = await fetchSearchCandidates(trimmed, sortBy);
          if (candidates && candidates.length > 0) {
            searchCache.set(normalizedKey, candidates);
          }
        } catch {
          if (thisRequestId === requestIdRef.current) {
            setLoading(false);
            setResults([]);
          }
          return;
        }
      }

      // Stale search response check (ignore if newer request exists)
      if (thisRequestId !== requestIdRef.current) return;

      // 3. Deterministic relevance ranking using current installed set and known display names
      const rankStartTime = performance.now();
      const ranked = rankPackages(candidates || [], trimmed, {
        installedPackages: installed,
        knownDisplayNames: KNOWN_DISPLAY_NAMES,
      });
      const rankTime = performance.now() - rankStartTime;
      const totalTime = performance.now() - startTime;

      // 4. Local dev telemetry diagnostics
      if (import.meta.env.DEV) {
        console.log(`[Aura Search] Query: "${trimmed}" | Candidates: ${candidates?.length || 0} | Cache: ${cacheHit ? 'HIT' : 'MISS'} | Ranking: ${rankTime.toFixed(1)}ms | Total: ${totalTime.toFixed(1)}ms | Top match: ${ranked[0]?.package?.Name || 'none'} (${ranked[0]?.matchReason || 'none'})`);
      }

      setResults(ranked);
      setLoading(false);
    }, 500); // 500ms debounce per spec

    return () => clearTimeout(searchTimer.current);
  }, [query, sortBy, installed]);

  // Run single install / remove with authoritative operation model
  const runPackageAction = useCallback((pkgOrName, action, onFinish) => {
    const isFlathub = typeof pkgOrName === 'object' && pkgOrName?.Source === 'flathub';
    const pkgName = typeof pkgOrName === 'object' ? pkgOrName.Name : pkgOrName;
    // Flathub install/uninstall needs the reverse-DNS AppId, not the human display name.
    const installId = isFlathub ? pkgOrName.AppId : pkgName;

    setActivePkg(pkgName);
    setActiveAction(action);
    setIsProcessing(true);
    setOpState('resolving');
    setMetrics({});
    setLastError(null);
    setTermLogs([]);

    streamInstall(installId, action, {
      source: isFlathub ? 'flathub' : undefined,
      onLog: (log, type) => setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]),
      onAuthRequired: (data) => setAuthRequest(data),
      onStateChange: (event, opId) => {
        if (opId) setActiveOpId(opId);
        setOpState(event.state);
        if (event.error) setLastError(event.error);
      },
      onMetrics: (m) => setMetrics(m),
      onDone: (ok, error, finalStatus, opId) => {
        setIsProcessing(false);
        setAuthRequest(null);
        const status = finalStatus || (ok ? 'completed' : 'failed');
        setOpState(status);
        setActiveOpId(null);

        if (error) setLastError(error);

        // Refresh server operation history
        getServerOperationHistory().then(({ history: h }) => {
          if (h && h.length > 0) setHistory(h);
        });

        if (ok) {
          setTermLogs(prev => [...prev, { text: `✓ Completed ${pkgName}`, type: 'done' }]);
          refreshPackages();
          addToast(`${pkgName} ${action === 'remove' ? 'removed' : 'installed'} successfully!`, 'success');
        } else if (status === 'cancelled') {
          setTermLogs(prev => [...prev, { text: `⊘ Cancelled ${pkgName}`, type: 'warning' }]);
          addToast(`Installation cancelled for ${pkgName}`, 'info');
        } else {
          setTermLogs(prev => [...prev, { text: `✕ Failed for ${pkgName}`, type: 'error' }]);
          addToast(error?.message || `Action failed for ${pkgName}`, 'error');
        }
        if (onFinish) onFinish(ok);
      },
    });
  }, [addToast, refreshPackages]);

  // Execute Batch Update Queue sequentially
  useEffect(() => {
    if (!batchActive || batchList.length === 0) return;

    if (batchIndex >= batchList.length) {
      setBatchActive(false);
      setIsProcessing(false);
      setActivePkg('');
      
      const failedCount = Object.values(pkgStatusMap).filter(s => s === 'failed').length;
      if (failedCount === 0) {
        addToast('All selected updates completed successfully!', 'success');
      } else {
        addToast(`Updates finished: ${failedCount} package(s) failed. Click View Logs to inspect.`, 'error');
      }
      refreshPackages();
      return;
    }

    const currentPkg = batchList[batchIndex];
    setPkgStatusMap(prev => ({ ...prev, [currentPkg]: 'updating' }));

    runPackageAction(currentPkg, 'install', (ok) => {
      setPkgStatusMap(prev => ({ ...prev, [currentPkg]: ok ? 'done' : 'failed' }));
      setBatchIndex(i => i + 1);
    });
  }, [batchActive, batchIndex, batchList, runPackageAction, addToast, refreshPackages]);

  // Trigger batch update
  const handleUpdateBatch = (pkgList) => {
    if (pkgList.length === 0 || batchActive) return;
    const initialMap = {};
    pkgList.forEach(n => { initialMap[n] = 'waiting'; });
    setPkgStatusMap(initialMap);
    setBatchList(pkgList);
    setBatchIndex(0);
    setBatchActive(true);
    addToast(`Starting batch update for ${pkgList.length} packages…`, 'info');
  };

  const handleUpdateSingle = (pkgName) => {
    setPkgStatusMap(prev => ({ ...prev, [pkgName]: 'updating' }));
    runPackageAction(pkgName, 'install', (ok) => {
      setPkgStatusMap(prev => ({ ...prev, [pkgName]: ok ? 'done' : 'failed' }));
    });
  };

  const handleQuickInstall = (pkg) => {
    runPackageAction(pkg, 'install');
  };

  const handleLaunchApp = async (pkgName, displayName, desktopFile, actionId = null) => {
    addToast(`Launching ${displayName}…`, 'info');
    await launchApp(pkgName, desktopFile, actionId);
  };

  const handleCancelInstall = async () => {
    addToast('Cancelling active operation…', 'info');
    await cancelInstall(activeOpId);
    setIsProcessing(false);
    setBatchActive(false);
    setActivePkg('');
    setActiveOpId(null);
    setOpState('cancelled');
    addToast('Installation cancelled. No changes made.', 'info');
    refreshPackages();
  };

  const handleUnlockDatabase = async () => {
    addToast('Unlocking pacman database…', 'info');
    const res = await unlockPacman();
    if (res.ok) {
      setLockStatus({ hasLock: false, isLockStale: false, message: '' });
      addToast('Pacman database unlocked successfully.', 'success');
    } else {
      addToast(res.message || 'Failed to unlock database.', 'error');
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem('aura_operation_history_v1');
    setHistory([]);
    addToast('Cleared activity history.', 'info');
  };

  const handleDependencyClick = async (depName) => {
    setLoading(true);
    const info = await getPackageInfo(depName);
    if (info) {
      if (selectedPkg) {
        setPkgStack(prev => [...prev, selectedPkg]);
      }
      setSelectedPkg(info);
    } else {
      setQuery(depName);
      setPkgStack([]);
      setSelectedPkg(null);
    }
    setLoading(false);
  };

  const handleNav = (id) => {
    setView(id);
    setSelectedPkg(null);
    setPkgStack([]);
    setQuery('');
  };

  const isSearching = query.trim().length > 0;
  const currentCategory = CATEGORIES.find(c => c.id === view);
  const showSortSelector = !selectedPkg && (isSearching || Boolean(currentCategory));

  return (
    <div className="app-shell">
      <Sidebar
        active={selectedPkg ? '' : view}
        onNav={handleNav}
        installedCount={aurInstalled.length}
        updateCount={updates.length}
      />

      <div className="main">
        {/* Header with Adaptive Controls */}
        <div className="header">
          <div className="search-wrapper" style={{ position: 'relative' }}>
            <span className="search-icon" style={{ display: 'inline-flex' }}><Search size={15} strokeWidth={2} /></span>
            <input
              ref={searchInputRef}
              className="search-input"
              type="text"
              placeholder="Search AUR packages, apps, developers... (Ctrl K)"
              value={query}
              onFocus={() => setPaletteOpen(true)}
              onChange={e => {
                setQuery(e.target.value);
                setPaletteOpen(true);
                if (selectedPkg) setSelectedPkg(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (e.ctrlKey || e.metaKey) {
                    setPaletteOpen(false);
                    if (query.trim()) addRecentSearch(query);
                  } else if (results.length > 0) {
                    addRecentSearch(query);
                    setSelectedPkg(results[0].package);
                    setPaletteOpen(false);
                  }
                }
              }}
            />
            {!query && <span className="search-shortcut">Ctrl K</span>}

            <CommandPalette
              results={results}
              visible={paletteOpen}
              installed={installed}
              onSelect={(pkg) => {
                addRecentSearch(query || pkg.Name);
                setSelectedPkg(pkg);
                setPaletteOpen(false);
              }}
              onViewAll={() => {
                addRecentSearch(query);
                setPaletteOpen(false);
              }}
              onClose={() => setPaletteOpen(false)}
              loading={loading}
              query={query}
              recentSearches={recentSearches}
              onRecentClick={(rq) => {
                setQuery(rq);
                setPaletteOpen(true);
              }}
            />
          </div>

          <div className="header-actions">
            {showSortSelector && (
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name-desc">Relevance</option>
                <option value="popularity">Popularity</option>
                <option value="votes">Votes</option>
                <option value="lastmodified">Recently Updated</option>
              </select>
            )}
            <button
              className="header-btn"
              title="Refresh package data"
              onClick={() => { refreshPackages(); addToast('Refreshed package lists', 'info'); }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RotateCcw size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Database Lock Recovery Banner (Strict Active vs Stale Distinction) */}
        {lockStatus.hasLock && (
          <div style={{
            background: 'var(--surface-hover)',
            borderBottom: `1px solid ${lockStatus.isLockStale ? 'var(--warning)' : 'var(--danger)'}`,
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: lockStatus.isLockStale ? 'var(--warning)' : 'var(--danger)', fontWeight: 600 }}>
                {lockStatus.isLockStale ? <><AlertTriangle size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />Stale Database Lock</> : <><Lock size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />Package Manager Active</>}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{lockStatus.message}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {lockStatus.isLockStale ? (
                <button className="btn btn-primary btn-sm" onClick={handleUnlockDatabase}>
                  Clean Lock
                </button>
              ) : (
                <span className="chip chip-gray" style={{ fontSize: 11 }}>Read-Only Mode</span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setLockStatus({ hasLock: false })}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Top Progress Bar (Authoritative State Machine & Transfer Metrics) */}
        <TopProgressBar
          active={isProcessing}
          pkgName={activePkg}
          batchIndex={batchIndex}
          batchTotal={batchActive ? batchList.length : 0}
          action={activeAction}
          opState={opState}
          metrics={metrics}
          logs={termLogs}
          onCancel={handleCancelInstall}
          onToggleTerminal={() => setTermOpen(o => !o)}
          terminalOpen={termOpen}
        />

        {/* Content Viewport */}
        <div className="content" style={{ paddingBottom: termOpen ? 230 : 26 }}>

          {/* Dedicated Package Detail Screen */}
          {selectedPkg ? (
            <PackageDetail
              pkg={selectedPkg}
              installed={installed}
              updates={updates}
              aurInstalledList={aurInstalled}
              isInstalling={isProcessing && activePkg === selectedPkg.Name}
              opState={opState}
              lastError={lastError}
              installLogs={termLogs}
              onBack={() => {
                if (pkgStack.length > 0) {
                  const prev = pkgStack[pkgStack.length - 1];
                  setPkgStack(s => s.slice(0, -1));
                  setSelectedPkg(prev);
                } else {
                  setSelectedPkg(null);
                }
              }}
              onInstallStart={(pkg, action) => runPackageAction(pkg, action)}
              onCancel={handleCancelInstall}
              onLaunch={handleLaunchApp}
              onSelectDependency={handleDependencyClick}
              onToggleTerminal={() => setTermOpen(o => !o)}
              addToast={addToast}
            />
          ) : isSearching ? (
            /* Search Results Mode */
            <div>
              <div className="section-header">
                <div>
                  <div className="section-title">Results for "{query}"</div>
                  {!loading && <div className="section-count">{results.length} AUR packages found</div>}
                </div>
                {loading && <div className="spinner-apple" />}
              </div>

              {loading ? (
                <SkeletonGrid count={6} />
              ) : results.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><SearchX size={26} strokeWidth={1.75} /></div>
                  <div className="empty-title">No packages found for "{query}"</div>
                  <div className="empty-desc">Try a shorter package name, the application's name, or a related keyword.</div>
                </div>
              ) : (
                <>
                  {/* Best Matches Rail (Top 4) */}
                  <div style={{ marginBottom: results.length > 4 ? 24 : 0 }}>
                    {results.length > 4 && (
                      <div className="section-header" style={{ marginBottom: 10 }}>
                        <div className="section-title" style={{ fontSize: 13, color: 'var(--accent)' }}>Best Matches</div>
                        <div className="section-count">Top relevance</div>
                      </div>
                    )}
                    <div className="app-grid popular-grid">
                      {results.slice(0, 4).map((item, i) => (
                        <AppCard
                          key={item.package.Name}
                          pkg={item.package}
                          index={i}
                          installed={installed}
                          installedInfo={installedInfoMap}
                          isTopMatch={i === 0}
                          onSelect={(pkg) => {
                            addRecentSearch(query);
                            setSelectedPkg(pkg);
                          }}
                          onQuickInstall={handleQuickInstall}
                          onLaunch={handleLaunchApp}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Other Results (Remaining) */}
                  {results.length > 4 && (
                    <div>
                      <div className="section-header" style={{ marginBottom: 10 }}>
                        <div className="section-title" style={{ fontSize: 13 }}>Other Results</div>
                        <div className="section-count">{results.length - 4} more packages</div>
                      </div>
                      <div className="app-grid">
                        {results.slice(4).map((item, i) => (
                          <AppCard
                            key={item.package.Name}
                            pkg={item.package}
                            index={i + 4}
                            installed={installed}
                            installedInfo={installedInfoMap}
                            onSelect={(pkg) => {
                              addRecentSearch(query);
                              setSelectedPkg(pkg);
                            }}
                            onQuickInstall={handleQuickInstall}
                            onLaunch={handleLaunchApp}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : view === 'explore' ? (
            /* Explore Homepage Mode */
            <>
              {/* Search-As-Hero Header */}
              <div className="search-hero">
                <h1 className="search-hero-title">Discover Software</h1>
                <p className="search-hero-subtitle">
                  Find software for your Arch system from the Arch User Repository.
                </p>
              </div>

              {/* Popular on AUR Rail (Curated top 4) */}
              <div>
                <div className="section-header">
                  <div className="section-title">Popular on AUR</div>
                  <div className="section-count">{popularPkgs.length} packages</div>
                </div>
                {popularPkgs.length === 0 ? (
                  <SkeletonGrid count={4} popular={true} />
                ) : (
                  <div className="app-grid popular-grid">
                    {popularPkgs.map((pkg, i) => (
                      <AppCard
                        key={pkg.Name}
                        pkg={pkg}
                        index={i}
                        installed={installed}
                        installedInfo={installedInfoMap}
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
                        onLaunch={handleLaunchApp}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Essential Tools Rail (Curated top 4) */}
              <div>
                <div className="section-header">
                  <div className="section-title">System & CLI Essentials</div>
                  <div className="section-count">{essentialPkgs.length} utilities</div>
                </div>
                {essentialPkgs.length === 0 ? (
                  <SkeletonGrid count={4} />
                ) : (
                  <div className="app-grid">
                    {essentialPkgs.map((pkg, i) => (
                      <AppCard
                        key={pkg.Name}
                        pkg={pkg}
                        index={i}
                        installed={installed}
                        installedInfo={installedInfoMap}
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
                        onLaunch={handleLaunchApp}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : currentCategory ? (
            /* Category View (Native & Lightweight Header) */
            <div>
              <div className="category-header-native" style={{ marginBottom: 16 }}>
                <span className="category-icon-native">{currentCategory.icon}</span>
                <div>
                  <h1 className="category-title-native">{currentCategory.title}</h1>
                  <p className="category-subtitle-native">{currentCategory.subtitle}</p>
                </div>
              </div>

              <div className="section-header">
                <div className="section-title">{currentCategory.label} Packages</div>
                <div className="section-count">{categoryPkgs.length} packages</div>
              </div>

              {loading ? (
                <SkeletonGrid count={4} />
              ) : categoryPkgs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">Can't find what you're looking for?</div>
                  <div className="empty-desc">Search the AUR for more packages in this category.</div>
                </div>
              ) : (
                <div className="app-grid">
                  {categoryPkgs.map((pkg, i) => (
                    <AppCard
                      key={pkg.Name}
                      pkg={pkg}
                      index={i}
                      installed={installed}
                      installedInfo={installedInfoMap}
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
                      onLaunch={handleLaunchApp}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : view === 'installed' ? (
            /* Installed Tab */
            <InstalledTab
              packages={aurInstalled}
              onSelect={setSelectedPkg}
              onLaunch={handleLaunchApp}
              addToast={addToast}
            />
          ) : view === 'updates' ? (
            /* Updates Tab */
            <UpdatesTab
              updates={updates}
              onUpdateSingle={handleUpdateSingle}
              onUpdateBatch={handleUpdateBatch}
              onShowLogs={() => setTermOpen(true)}
              batchActive={batchActive}
              batchIndex={batchIndex}
              batchList={batchList}
              pkgStatusMap={pkgStatusMap}
            />
          ) : view === 'activity' ? (
            /* Activity History Tab */
            <ActivityTab
              history={history}
              onSelectPkg={setSelectedPkg}
              onClearHistory={handleClearHistory}
            />
          ) : view === 'settings' ? (
            /* Settings & Storage Maintenance Tab */
            <SettingsTab addToast={addToast} />
          ) : null}

        </div>
      </div>

      {/* Terminal Drawer (Collapsible) */}
      <TerminalDrawer
        open={termOpen}
        onToggle={() => setTermOpen(o => !o)}
        logs={termLogs}
        installing={isProcessing}
        packageName={activePkg}
      />

      {/* In-App Sudo Authentication Modal */}
      {authRequest && (
        <AuthModal
          authRequest={authRequest}
          onRespond={async (authId, password, cancelled) => {
            await submitAuthResponse(authId, password, cancelled);
            setAuthRequest(null);
          }}
        />
      )}

      {/* Toast Notifications */}
      <ToastStack toasts={toasts} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
