import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import PackageDetail from './components/PackageDetail';
import TerminalDrawer from './components/TerminalDrawer';
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
function InstalledTab({ packages, installed, onSelect }) {
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
            <div style={{ fontSize: 24 }}>{getPackageIcon(pkg.name)}</div>
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

// ---------- Updates View ----------
function UpdatesTab({ updates, onInstallStart, onInstallDone, addToast, openTerminal }) {
  const [installing, setInstalling] = useState(new Set());
  const handleUpdate = (pkg) => {
    setInstalling(prev => new Set([...prev, pkg]));
    openTerminal();
    onInstallStart(pkg, 'install');
    streamInstall(pkg, 'install', (log, type) => onInstallStart(pkg, 'install', log, type), (ok) => {
      setInstalling(prev => { const s = new Set(prev); s.delete(pkg); return s; });
      onInstallDone(pkg, 'install', ok);
      addToast(ok ? `${pkg} updated successfully!` : `Failed to update ${pkg}`, ok ? 'success' : 'error');
    });
  };

  if (updates.length === 0) return (
    <div className="empty-state">
      <div className="empty-icon">✨</div>
      <div className="empty-title">All up to date!</div>
      <div className="empty-desc">No AUR package updates are currently available.</div>
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <div className="section-title">Available Updates</div>
        <div className="section-count">{updates.length} updates available</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {updates.map(u => (
          <div key={u.name} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: 'var(--fill-quaternary)', border: '1px solid var(--separator)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ fontSize: 22 }}>{getPackageIcon(u.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--label-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {u.current} → <span style={{ color: 'var(--apple-green)' }}>{u.latest}</span>
              </div>
            </div>
            <button
              className={installing.has(u.name) ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
              onClick={() => handleUpdate(u.name)}
              disabled={installing.has(u.name)}
            >
              {installing.has(u.name) ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Updating…</> : '↑ Update'}
            </button>
          </div>
        ))}
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
      <div className="hero-icon">{getPackageIcon(pkg.name)}</div>
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

// ---------- Main App ----------
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
  const [termOpen, setTermOpen] = useState(false);
  const [termLogs, setTermLogs] = useState([]);
  const [termInstalling, setTermInstalling] = useState(false);
  const [termPkg, setTermPkg] = useState('');
  const searchInputRef = useRef(null);
  const searchTimer = useRef(null);

  // Load installed, updates & trending on mount
  useEffect(() => {
    getInstalled().then(({ aur, allInstalled }) => {
      setInstalled(new Set(allInstalled));
      setAurInstalled(aur || []);
    }).catch(() => {});

    getUpdates().then(({ updates }) => setUpdates(updates || [])).catch(() => {});

    // Load featured
    Promise.all(FEATURED.map(f =>
      getPackageInfo(f.name).then(data => ({ ...f, data })).catch(() => ({ ...f, data: null }))
    )).then(setFeatured);

    // Load trending
    getMultiplePackageInfo(TRENDING_NAMES).then(setTrending);
  }, []);

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

  // Load category packages when switching to a category view
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

  const handleInstallStart = useCallback((pkg, action, log, type) => {
    setTermPkg(pkg);
    setTermInstalling(true);
    setTermOpen(true);
    if (log !== undefined) {
      setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]);
    }
  }, []);

  const handleInstallDone = useCallback((pkg, action, ok) => {
    setTermInstalling(false);
    if (ok) {
      setTermLogs(prev => [...prev, { text: `✓ ${action === 'remove' ? 'Removed' : 'Installed'} ${pkg} successfully!`, type: 'done' }]);
      getInstalled().then(({ aur, allInstalled }) => {
        setInstalled(new Set(allInstalled));
        setAurInstalled(aur || []);
      }).catch(() => {});
    } else {
      setTermLogs(prev => [...prev, { text: `✕ ${action} failed for ${pkg}`, type: 'error' }]);
    }
  }, []);

  const handleQuickInstall = useCallback((pkg) => {
    setTermLogs([]);
    setTermPkg(pkg.Name);
    setTermOpen(true);
    setTermInstalling(true);
    handleInstallStart(pkg.Name, 'install');
    streamInstall(pkg.Name, 'install',
      (log, type) => setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]),
      (ok) => {
        handleInstallDone(pkg.Name, 'install', ok);
        addToast(ok ? `${pkg.Name} installed!` : `Failed to install ${pkg.Name}`, ok ? 'success' : 'error');
      }
    );
  }, [handleInstallStart, handleInstallDone, addToast]);

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
            <button className="header-btn" title="Refresh data" onClick={() => {
              getInstalled().then(({ aur, allInstalled }) => { setInstalled(new Set(allInstalled)); setAurInstalled(aur || []); });
              getUpdates().then(({ updates }) => setUpdates(updates || []));
              addToast('Refreshed package lists', 'info');
            }}>↺</button>
          </div>
        </div>

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
              installed={installed}
              onSelect={setSelectedPkg}
            />
          )}

          {/* Updates Tab */}
          {!isSearching && view === 'updates' && (
            <UpdatesTab
              updates={updates}
              onInstallStart={handleInstallStart}
              onInstallDone={handleInstallDone}
              addToast={addToast}
              openTerminal={() => setTermOpen(true)}
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
          onInstallStart={(pkg, action) => {
            setTermLogs([]);
            setTermPkg(pkg);
            setTermOpen(true);
            setTermInstalling(true);
            streamInstall(pkg, action,
              (log, type) => setTermLogs(prev => [...prev, { text: log, type: type || 'log' }]),
              (ok) => handleInstallDone(pkg, action, ok)
            );
          }}
          onInstallDone={handleInstallDone}
          onSelectDependency={handleDependencyClick}
          addToast={addToast}
        />
      )}

      {/* Terminal Drawer */}
      <TerminalDrawer
        open={termOpen}
        onToggle={() => setTermOpen(o => !o)}
        logs={termLogs}
        installing={termInstalling}
        packageName={termPkg}
      />

      {/* Toast Notifications */}
      <ToastStack toasts={toasts} />
    </div>
  );
}
