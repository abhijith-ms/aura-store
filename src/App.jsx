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
  streamInstall, launchApp, cancelInstall, isLaunchable, CATEGORIES, getAppDisplayName, formatNumber, timeAgo
} from './services/aurApi';


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
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
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

// ---------- Installed Library View (Package Manager utility design) ----------
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
        <div className="empty-icon">📦</div>
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
                      onClick={() => onLaunch(pkg.name, displayName)}
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
        <div className="empty-icon">✨</div>
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
                  {u.name}: <span style={{ color: 'var(--text-muted)' }}>{u.current}</span> → <span style={{ color: 'var(--success)', fontWeight: 600 }}>{u.latest}</span>
                </div>
              </div>

              {/* Status Indicator */}
              {status === 'updating' ? (
                <span className="chip chip-indigo" style={{ padding: '4px 8px', gap: 5 }}>
                  <div className="spinner-apple" /> Building…
                </span>
              ) : status === 'done' ? (
                <span className="chip chip-green" style={{ padding: '4px 8px' }}>✓ Updated</span>
              ) : status === 'failed' ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="chip chip-red" style={{ padding: '4px 8px' }}>✕ Failed</span>
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
                <span className="chip chip-gray" style={{ padding: '4px 8px' }}>⏳ Queued</span>
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

  // Load initial packages dynamically sorted
  useEffect(() => {
    refreshPackages();
    getMultiplePackageInfo(DISCOVERY_POPULAR_CANDIDATES).then(pkgs => {
      const sorted = [...pkgs].sort((a, b) => (b.NumVotes || 0) - (a.NumVotes || 0));
      setPopularPkgs(sorted.slice(0, 4));
    });
    getMultiplePackageInfo(DISCOVERY_ESSENTIAL_CANDIDATES).then(pkgs => {
      const sorted = [...pkgs].sort((a, b) => (b.NumVotes || 0) - (a.NumVotes || 0));
      setEssentialPkgs(sorted.slice(0, 4));
    });
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
    }, 280);
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
    runPackageAction(pkg.Name, 'install');
  };

  const handleLaunchApp = async (pkgName, displayName) => {
    addToast(`Launching ${displayName}…`, 'info');
    await launchApp(pkgName);
  };

  const handleCancelInstall = async () => {
    if (!activePkg) return;
    const pkg = activePkg;
    addToast(`Cancelling installation for ${pkg}…`, 'info');
    await cancelInstall(pkg);
    setIsProcessing(false);
    setBatchActive(false);
    setActivePkg('');
    addToast('Installation cancelled. No changes made.', 'info');
    refreshPackages();
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
    setSelectedPkg(null);
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
          <div className="search-wrapper">
            <span className="search-icon">⌕</span>
            <input
              ref={searchInputRef}
              className="search-input"
              type="text"
              placeholder="Search AUR packages, apps, developers... (Ctrl K)"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                if (selectedPkg) setSelectedPkg(null);
              }}
            />
            {!query && <span className="search-shortcut">Ctrl K</span>}
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
            >
              ↺
            </button>
          </div>
        </div>

        {/* Top Progress Bar */}
        <TopProgressBar
          active={isProcessing}
          pkgName={activePkg}
          batchIndex={batchIndex}
          batchTotal={batchActive ? batchList.length : 0}
          action={activeAction}
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
              isInstalling={isProcessing && activePkg === selectedPkg.Name}
              installLogs={termLogs}
              onBack={() => setSelectedPkg(null)}
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
                  <div className="empty-icon">🔍</div>
                  <div className="empty-title">No packages found</div>
                  <div className="empty-desc">Try a different search term or check the package spelling.</div>
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
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
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
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
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
                      onSelect={setSelectedPkg}
                      onQuickInstall={handleQuickInstall}
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
