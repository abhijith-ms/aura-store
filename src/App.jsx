import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import PackageDetail from './components/PackageDetail';
import TerminalDrawer from './components/TerminalDrawer';
import TopProgressBar from './components/TopProgressBar';
import AppIcon from './components/AppIcon';
import { ThemeProvider } from './context/ThemeContext';
import {
  searchPackages, getInstalled, getUpdates, getPackageInfo, getMultiplePackageInfo,
  streamInstall, TRENDING_NAMES, CATEGORIES, getAppDisplayName, formatNumber, timeAgo
} from './services/aurApi';

// Essential CLI tools list for secondary Explore rail
const ESSENTIAL_TOOLS = ['paru', 'yay', 'btop', 'fastfetch-git', 'alacritty-git', 'timeshift'];

// ---------- Toast Notifications ----------
function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Installed Library View (with search filter) ----------
function InstalledTab({ packages, onSelect }) {
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
        <div className="empty-icon">📦</div>
        <div className="empty-title">No AUR Packages Installed</div>
        <div className="empty-desc">Packages you install from the AUR will appear here.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">Installed Applications</div>
          <div className="section-count">{packages.length} AUR packages installed</div>
        </div>

        <div style={{ width: 240, position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            style={{ padding: '6px 12px', fontSize: 12.5 }}
            placeholder="Filter installed…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}>
          <div className="empty-title">No matching installed packages</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(pkg => {
            const displayName = getAppDisplayName(pkg.name);
            return (
              <div
                key={pkg.name}
                onClick={() => onSelect({ Name: pkg.name, Version: pkg.version, Description: 'Locally installed AUR package' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <AppIcon pkgName={pkg.name} size="md" installed={true} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{displayName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {pkg.name} · v{pkg.version}
                  </div>
                </div>
                <span className="chip chip-green">✓ Installed</span>
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
        <div className="empty-icon">✨</div>
        <div className="empty-title">All Software Up to Date</div>
        <div className="empty-desc">No AUR package updates are currently available.</div>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div>
      <div className="section-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="section-title">Available Updates</div>
          <div className="section-count">{updates.length} updates available</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={selectAll} disabled={batchActive}>
            {selected.size === updates.length ? 'Deselect All' : 'Select All'}
          </button>

          <button
            className="btn btn-primary"
            onClick={() => onUpdateBatch([...selected])}
            disabled={batchActive || selectedCount === 0}
            style={{ gap: 8, padding: '8px 16px', fontSize: 13 }}
          >
            {batchActive ? (
              <>
                <div className="spinner-apple" />
                <span>Updating ({batchIndex + 1}/{batchList.length})…</span>
              </>
            ) : (
              <>
                <span>Update Selected ({selectedCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                gap: 14,
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSelect(u.name)}
                disabled={batchActive}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />

              <AppIcon pkgName={u.name} size="md" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{displayName}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {u.name}: {u.current} → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{u.latest}</span>
                </div>
              </div>

              {/* Status Indicator */}
              {status === 'updating' ? (
                <span className="chip chip-indigo" style={{ padding: '5px 10px', gap: 6 }}>
                  <div className="spinner-apple" /> Building…
                </span>
              ) : status === 'done' ? (
                <span className="chip chip-green" style={{ padding: '5px 10px' }}>✓ Updated</span>
              ) : status === 'failed' ? (
                <span className="chip chip-red" style={{ padding: '5px 10px' }}>✕ Failed</span>
              ) : status === 'waiting' ? (
                <span className="chip chip-gray" style={{ padding: '5px 10px' }}>⏳ Queued</span>
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
  const [view, setView] = useState('explore');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-desc');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [installed, setInstalled] = useState(new Set());
  const [aurInstalled, setAurInstalled] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [popularPkgs, setPopularPkgs] = useState([]);
  const [essentialPkgs, setEssentialPkgs] = useState([]);
  const [categoryPkgs, setCategoryPkgs] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Active install / update state
  const [activePkg, setActivePkg] = useState('');
  const [activeAction, setActiveAction] = useState('install');
  const [isProcessing, setIsProcessing] = useState(false);
  const [termLogs, setTermLogs] = useState([]);
  const [termOpen, setTermOpen] = useState(false);

  // Batch Update Queue State
  const [batchActive, setBatchActive] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchList, setBatchList] = useState([]);
  const [pkgStatusMap, setPkgStatusMap] = useState({});

  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);

  // Refresh package metadata
  const refreshPackages = useCallback(() => {
    getInstalled().then(({ aur, allInstalled }) => {
      setInstalled(new Set(allInstalled));
      setAurInstalled(aur || []);
    }).catch(() => {});
    getUpdates().then(({ updates: u }) => setUpdates(u || [])).catch(() => {});
  }, []);

  // Load initial packages
  useEffect(() => {
    refreshPackages();
    getMultiplePackageInfo(TRENDING_NAMES).then(setPopularPkgs);
    getMultiplePackageInfo(ESSENTIAL_TOOLS).then(setEssentialPkgs);
  }, [refreshPackages]);

  // Global Keyboard Shortcuts (Ctrl+K and Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (selectedPkg) {
          setSelectedPkg(null);
        } else if (query) {
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPkg, query]);

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

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchPackages(query, sortBy).catch(() => []);
      setResults(res.slice(0, 60));
      setLoading(false);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [query, sortBy]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Run single install / remove
  const runPackageAction = useCallback((pkgName, action, onFinish) => {
    setActivePkg(pkgName);
    setActiveAction(action);
    setIsProcessing(true);
    setTermLogs([]);

    streamInstall(
      pkgName,
      action,
      (log, type) => setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]),
      (ok) => {
        setIsProcessing(false);
        if (ok) {
          setTermLogs(prev => [...prev, { text: `✓ Completed ${pkgName}`, type: 'done' }]);
          refreshPackages();
          addToast(`${pkgName} ${action === 'remove' ? 'removed' : 'installed'} successfully!`, 'success');
        } else {
          setTermLogs(prev => [...prev, { text: `✕ Failed for ${pkgName}`, type: 'error' }]);
          addToast(`Action failed for ${pkgName}`, 'error');
        }
        if (onFinish) onFinish(ok);
      }
    );
  }, [addToast, refreshPackages]);

  // Execute Batch Update Queue sequentially
  useEffect(() => {
    if (!batchActive || batchList.length === 0) return;

    if (batchIndex >= batchList.length) {
      setBatchActive(false);
      setIsProcessing(false);
      setActivePkg('');
      addToast('All selected updates completed!', 'success');
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
    runPackageAction(pkg.Name, 'install');
  };

  const handleDependencyClick = async (depName) => {
    setLoading(true);
    const info = await getPackageInfo(depName);
    if (info) {
      setSelectedPkg(info);
    } else {
      setQuery(depName);
      setSelectedPkg(null);
    }
    setLoading(false);
  };

  const handleNav = (id) => {
    setView(id);
    setQuery('');
  };

  const isSearching = query.trim().length > 0;
  const currentCategory = CATEGORIES.find(c => c.id === view);

  return (
    <div className="app-shell">
      <Sidebar
        active={view}
        onNav={handleNav}
        installedCount={aurInstalled.length}
        updateCount={updates.length}
      />

      <div className="main">
        {/* Header */}
        <div className="header">
          <div className="search-wrapper">
            <span className="search-icon">⌕</span>
            <input
              ref={searchInputRef}
              className="search-input"
              type="text"
              placeholder="Search AUR packages, apps, developers... (Ctrl K)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {!query && <span className="search-shortcut">Ctrl K</span>}
          </div>

          <div className="header-actions">
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name-desc">Relevance</option>
              <option value="popularity">Popularity</option>
              <option value="votes">Votes</option>
              <option value="lastmodified">Recently Updated</option>
            </select>
            <button
              className="header-btn"
              title="Refresh repository"
              onClick={() => { refreshPackages(); addToast('Refreshed package lists', 'info'); }}
            >
              ↺
            </button>
          </div>
        </div>

        {/* Top Progress Bar (macOS / Steam style) */}
        <TopProgressBar
          active={isProcessing}
          pkgName={activePkg}
          batchIndex={batchIndex}
          batchTotal={batchActive ? batchList.length : 0}
          action={activeAction}
          logs={termLogs}
          onToggleTerminal={() => setTermOpen(o => !o)}
          terminalOpen={termOpen}
        />

        {/* Content Viewport */}
        <div className="content" style={{ paddingBottom: termOpen ? 240 : 28 }}>

          {/* Search Results Mode */}
          {isSearching && (
            <div>
              <div className="section-header">
                <div>
                  <div className="section-title">Results for "{query}"</div>
                  {!loading && <div className="section-count">{results.length} AUR packages found</div>}
                </div>
                {loading && <div className="spinner-apple" />}
              </div>

              {results.length === 0 && !loading ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-title">No Packages Found</div>
                  <div className="empty-desc">Try checking the package spelling or searching for a broader term.</div>
                </div>
              ) : (
                <div className="app-grid">
                  {results.map((pkg, i) => (
                    <AppCard
                      key={pkg.Name}
                      pkg={pkg}
                      index={i}
                      installed={installed}
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Explore Homepage Mode */}
          {!isSearching && view === 'explore' && (
            <>
              {/* Search-As-Hero Header */}
              <div className="search-hero">
                <h1 className="search-hero-title">Discover Software</h1>
                <p className="search-hero-subtitle">
                  Browse, search, and manage community packages from the Arch User Repository.
                </p>
              </div>

              {/* Popular on AUR Rail */}
              <div>
                <div className="section-header">
                  <div className="section-title">Popular on AUR</div>
                  <div className="section-count">Community favorites</div>
                </div>
                <div className="app-grid">
                  {popularPkgs.map((pkg, i) => (
                    <AppCard
                      key={pkg.Name}
                      pkg={pkg}
                      index={i}
                      installed={installed}
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
                    />
                  ))}
                </div>
              </div>

              {/* Essential Tools Rail */}
              <div>
                <div className="section-header">
                  <div className="section-title">System & CLI Essentials</div>
                  <div className="section-count">Utilities for Arch Linux</div>
                </div>
                <div className="app-grid">
                  {essentialPkgs.map((pkg, i) => (
                    <AppCard
                      key={pkg.Name}
                      pkg={pkg}
                      index={i}
                      installed={installed}
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Category View */}
          {!isSearching && currentCategory && (
            <div>
              <div className="category-banner" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 32 }}>{currentCategory.icon}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{currentCategory.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{currentCategory.subtitle}</div>
                </div>
              </div>

              <div className="section-header">
                <div className="section-title">{currentCategory.label} Packages</div>
                <div className="section-count">{categoryPkgs.length} packages</div>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner-apple" /></div>
              ) : (
                <div className="app-grid">
                  {categoryPkgs.map((pkg, i) => (
                    <AppCard
                      key={pkg.Name}
                      pkg={pkg}
                      index={i}
                      installed={installed}
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Installed Tab */}
          {!isSearching && view === 'installed' && (
            <InstalledTab
              packages={aurInstalled}
              onSelect={setSelectedPkg}
            />
          )}

          {/* Updates Tab */}
          {!isSearching && view === 'updates' && (
            <UpdatesTab
              updates={updates}
              onUpdateSingle={handleUpdateSingle}
              onUpdateBatch={handleUpdateBatch}
              batchActive={batchActive}
              batchIndex={batchIndex}
              batchList={batchList}
              pkgStatusMap={pkgStatusMap}
            />
          )}

        </div>
      </div>

      {/* Package Detail Modal */}
      {selectedPkg && (
        <PackageDetail
          pkg={selectedPkg}
          installed={installed}
          onClose={() => setSelectedPkg(null)}
          onInstallStart={(pkg, action) => runPackageAction(pkg, action)}
          onSelectDependency={handleDependencyClick}
          addToast={addToast}
        />
      )}

      {/* Terminal Drawer (Collapsible) */}
      <TerminalDrawer
        open={termOpen}
        onToggle={() => setTermOpen(o => !o)}
        logs={termLogs}
        installing={isProcessing}
        packageName={activePkg}
      />

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
