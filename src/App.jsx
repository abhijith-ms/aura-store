import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import PackageDetail from './components/PackageDetail';
import TerminalDrawer from './components/TerminalDrawer';
import TopProgressBar from './components/TopProgressBar';
import AppIcon from './components/AppIcon';
import {
  searchPackages, getInstalled, getUpdates, getPackageInfo, getMultiplePackageInfo,
  streamInstall, FEATURED, TRENDING_NAMES, CATEGORIES, getPackageIcon, formatNumber, timeAgo
} from './services/aurApi';

// ---------- Toast ----------
function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------- Installed View ----------
function InstalledTab({ packages, onSelect }) {
  if (packages.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">📦</div>
      <div className="empty-title">No AUR Packages</div>
      <div className="empty-desc">Packages installed from the AUR will appear here.</div>
    </div>
  );
  return (
    <div>
      <div className="section-header">
        <div className="section-title">Installed AUR Packages</div>
        <div className="section-count">{packages.length} packages</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {packages.map(pkg => (
          <div key={pkg.name}
            onClick={() => onSelect({ Name: pkg.name, Version: pkg.version, Description: 'Locally installed AUR package' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              background: 'var(--fill-quaternary)', border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.18s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--fill-primary)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--separator)'}
          >
            <AppIcon pkgName={pkg.name} size="md" installed={true} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--label-primary)' }}>{pkg.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--label-tertiary)', fontFamily: 'var(--font-mono)' }}>v{pkg.version}</div>
            </div>
            <span className="chip chip-green">✓ Installed</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Updates View (with Update All) ----------
function UpdatesTab({
  updates,
  onUpdateSingle,
  onUpdateAll,
  batchActive,
  batchIndex,
  batchList,
  pkgStatusMap,
}) {
  if (updates.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">✨</div>
      <div className="empty-title">All up to date!</div>
      <div className="empty-desc">No AUR package updates are currently available.</div>
    </div>
  );

  return (
    <div>
      <div className="section-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-title">Available Updates</div>
          <div className="section-count">{updates.length} updates available</div>
        </div>

        {/* Update All Button */}
        <button
          className="btn btn-primary btn-lg"
          onClick={onUpdateAll}
          disabled={batchActive}
          style={{ gap: 8, padding: '9px 20px', fontSize: 13 }}
        >
          {batchActive ? (
            <>
              <div className="spinner-apple" />
              <span>Updating All ({batchIndex + 1}/{batchList.length})…</span>
            </>
          ) : (
            <>
              <span>⚡ Update All</span>
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '1px 7px', borderRadius: 99, fontSize: 11 }}>
                {updates.length}
              </span>
            </>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {updates.map(u => {
          const status = pkgStatusMap[u.name] || 'idle';
          return (
            <div key={u.name} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              background: 'var(--fill-quaternary)', border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <AppIcon pkgName={u.name} size="md" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {u.current} → <span style={{ color: 'var(--apple-green)' }}>{u.latest}</span>
                </div>
              </div>

              {/* Status Indicator / Action */}
              {status === 'updating' ? (
                <span className="chip chip-indigo" style={{ padding: '6px 12px', gap: 6 }}>
                  <div className="spinner-apple" /> Updating…
                </span>
              ) : status === 'done' ? (
                <span className="chip chip-green" style={{ padding: '6px 12px' }}>✓ Updated</span>
              ) : status === 'failed' ? (
                <span className="chip chip-red" style={{ padding: '6px 12px' }}>✕ Failed</span>
              ) : status === 'waiting' ? (
                <span className="chip chip-gray" style={{ padding: '6px 12px' }}>⏳ Waiting</span>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onUpdateSingle(u.name)}
                  disabled={batchActive}
                >
                  ↑ Update
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Hero Featured Card ----------
function HeroCard({ pkg, installed, onSelect, onInstall }) {
  const isInstalled = installed.has(pkg.data?.Name);
  if (!pkg.data) return null;
  return (
    <div className="hero" onClick={() => onSelect(pkg.data)}>
      <AppIcon pkgName={pkg.data.Name} size="hero" installed={isInstalled} />
      <div className="hero-info">
        <div className="hero-label">{pkg.label}</div>
        <div className="hero-name">{pkg.data.Name}</div>
        <div className="hero-desc">{pkg.data.Description}</div>
        <div className="hero-meta">
          <div className="hero-stat">⭐ {formatNumber(pkg.data.NumVotes)} votes</div>
          <div className="hero-stat">📈 {pkg.data.Popularity?.toFixed(2)} popularity</div>
          <div className="hero-stat">🕐 {timeAgo(pkg.data.LastModified)}</div>
        </div>
      </div>
      <div style={{ flexShrink: 0, zIndex: 1 }}>
        {isInstalled ? (
          <button className="btn btn-installed btn-lg" onClick={e => e.stopPropagation()}>✓ Installed</button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={e => { e.stopPropagation(); onInstall(pkg.data); }}>
            Get
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Main App Component ----------
export default function App() {
  const [view, setView] = useState('explore');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-desc');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [installed, setInstalled] = useState(new Set());
  const [aurInstalled, setAurInstalled] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);
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

  // Load on mount
  useEffect(() => {
    refreshPackages();
    Promise.all(FEATURED.map(f =>
      getPackageInfo(f.name).then(data => ({ ...f, data })).catch(() => ({ ...f, data: null }))
    )).then(setFeatured);
    getMultiplePackageInfo(TRENDING_NAMES).then(setTrending);
  }, [refreshPackages]);

  // Keyboard shortcut: Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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
    }, 320);
    return () => clearTimeout(searchTimer.current);
  }, [query, sortBy]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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
      // Completed full batch
      setBatchActive(false);
      setIsProcessing(false);
      setActivePkg('');
      addToast('All updates completed!', 'success');
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

  // Trigger Update All
  const handleUpdateAll = () => {
    if (updates.length === 0 || batchActive) return;
    const names = updates.map(u => u.name);
    const initialMap = {};
    names.forEach(n => { initialMap[n] = 'waiting'; });
    setPkgStatusMap(initialMap);
    setBatchList(names);
    setBatchIndex(0);
    setBatchActive(true);
    addToast(`Starting batch update for ${names.length} packages…`, 'info');
  };

  // Trigger single update from Updates tab
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
              placeholder="Search AUR packages… (⌘K)"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {!query && <span className="search-shortcut">⌘K</span>}
          </div>
          <div className="header-actions">
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name-desc">Sort: Relevance</option>
              <option value="popularity">Sort: Popularity</option>
              <option value="votes">Sort: Votes</option>
              <option value="lastmodified">Sort: Updated</option>
            </select>
            <button className="header-btn" title="Refresh data" onClick={() => { refreshPackages(); addToast('Refreshed package lists', 'info'); }}>↺</button>
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

        {/* Content */}
        <div className="content" style={{ paddingBottom: termOpen ? 268 : 24 }}>

          {/* Search results */}
          {isSearching && (
            <div>
              <div className="section-header">
                <div className="section-title">Results for "{query}"</div>
                {!loading && <div className="section-count">{results.length} packages found</div>}
                {loading && <div className="spinner" />}
              </div>
              {results.length === 0 && !loading ? (
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
          )}

          {/* Explore View */}
          {!isSearching && view === 'explore' && (
            <>
              {featured.filter(f => f.data).length > 0 && (
                <div>
                  <div className="section-header">
                    <div className="section-title">✦ Featured</div>
                  </div>
                  <HeroCard
                    pkg={featured.find(f => f.data) || featured[0]}
                    installed={installed}
                    onSelect={setSelectedPkg}
                    onInstall={handleQuickInstall}
                  />
                </div>
              )}

              {featured.filter(f => f.data).length > 1 && (
                <div>
                  <div className="section-header">
                    <div className="section-title">Popular Picks</div>
                    <div className="section-count">Curated essentials</div>
                  </div>
                  <div className="app-grid">
                    {featured.filter(f => f.data).slice(1).map((f, i) => (
                      <AppCard
                        key={f.name}
                        pkg={f.data}
                        index={i}
                        installed={installed}
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Preview */}
              {trending.length > 0 && (
                <div>
                  <div className="section-header">
                    <div className="section-title">🔥 Top Charts Preview</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setView('trending')}>View All Top Charts →</button>
                  </div>
                  <div className="app-grid">
                    {trending.slice(0, 6).map((pkg, i) => (
                      <AppCard
                        key={pkg.Name}
                        pkg={pkg}
                        index={i}
                        rank={`#${i + 1}`}
                        installed={installed}
                        onSelect={setSelectedPkg}
                        onQuickInstall={handleQuickInstall}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Trending / Top Charts View */}
          {!isSearching && view === 'trending' && (
            <div>
              <div className="section-header">
                <div className="section-title">🔥 Top Charts</div>
                <div className="section-count">Most popular & highly voted AUR packages</div>
              </div>
              <div className="app-grid">
                {trending.map((pkg, i) => (
                  <AppCard
                    key={pkg.Name}
                    pkg={pkg}
                    index={i}
                    rank={`#${i + 1}`}
                    installed={installed}
                    onSelect={setSelectedPkg}
                    onQuickInstall={handleQuickInstall}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category View */}
          {!isSearching && currentCategory && (
            <div>
              <div className="category-banner" style={{ marginBottom: 20 }}>
                <div className="hero-icon">{currentCategory.icon}</div>
                <div className="hero-info">
                  <div className="hero-name">{currentCategory.title}</div>
                  <div className="hero-desc">{currentCategory.subtitle}</div>
                </div>
              </div>

              <div className="section-header">
                <div className="section-title">Curated in {currentCategory.label}</div>
                <div className="section-count">{categoryPkgs.length} apps</div>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
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
              onUpdateAll={handleUpdateAll}
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
          onInstallDone={() => {}}
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
