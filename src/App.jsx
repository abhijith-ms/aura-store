import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AppCard from './components/AppCard';
import PackageDetail from './components/PackageDetail';
import TerminalDrawer from './components/TerminalDrawer';
import {
  searchPackages, getInstalled, getUpdates, getPackageInfo,
  streamInstall, FEATURED, getPackageIcon, formatNumber, timeAgo
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
function InstalledTab({ packages, installed, onSelect, onQuickInstall }) {
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
            onClick={() => onSelect({ Name: pkg.name, Version: pkg.version, Description: 'AUR Package' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
              background: 'var(--surface-1)', border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.18s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--glass-border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
          >
            <div style={{ fontSize: 24 }}>{getPackageIcon(pkg.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--label-primary)' }}>{pkg.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--label-tertiary)', fontFamily: 'monospace' }}>v{pkg.version}</div>
            </div>
            <span className="chip chip-green">✓ AUR</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Updates View ----------
function UpdatesTab({ updates, installed, onInstallStart, onInstallDone, addToast, openTerminal }) {
  const [installing, setInstalling] = useState(new Set());
  const handleUpdate = (pkg) => {
    setInstalling(prev => new Set([...prev, pkg]));
    openTerminal();
    onInstallStart(pkg, 'install');
    streamInstall(pkg, 'install', (log, type) => onInstallStart(pkg, 'install', log, type), (ok) => {
      setInstalling(prev => { const s = new Set(prev); s.delete(pkg); return s; });
      onInstallDone(pkg, 'install', ok);
      addToast(ok ? `${pkg} updated!` : `Failed to update ${pkg}`, ok ? 'success' : 'error');
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
        <div className="section-count">{updates.length} updates</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {updates.map(u => (
          <div key={u.name} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
            background: 'var(--surface-1)', border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius)'
          }}>
            <div style={{ fontSize: 22 }}>{getPackageIcon(u.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--label-tertiary)', fontFamily: 'monospace' }}>
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
    <div className="hero" style={{ cursor: 'pointer' }} onClick={() => onSelect(pkg.data)}>
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
            ⬇ Install
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
  const [toasts, setToasts] = useState([]);
  const [termOpen, setTermOpen] = useState(false);
  const [termLogs, setTermLogs] = useState([]);
  const [termInstalling, setTermInstalling] = useState(false);
  const [termPkg, setTermPkg] = useState('');
  const searchTimer = useRef(null);

  // Load installed & updates on mount
  useEffect(() => {
    getInstalled().then(({ aur, allInstalled }) => {
      setInstalled(new Set(allInstalled));
      setAurInstalled(aur);
    }).catch(() => {});
    getUpdates().then(({ updates }) => setUpdates(updates || [])).catch(() => {});
    // Load featured
    Promise.all(FEATURED.map(f =>
      getPackageInfo(f.name).then(data => ({ ...f, data })).catch(() => ({ ...f, data: null }))
    )).then(setFeatured);
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchPackages(query, sortBy).catch(() => []);
      setResults(res.slice(0, 60));
      setLoading(false);
    }, 380);
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
        setAurInstalled(aur);
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

  const handleNav = (id, categoryQuery) => {
    setView(id);
    if (categoryQuery) {
      setQuery(categoryQuery);
    } else if (id === 'explore' || id === 'trending') {
      setQuery('');
    }
  };

  const isSearching = query.trim().length > 0;
  const showExplore = view === 'explore' && !isSearching;
  const showSearch = isSearching;

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
              className="search-input"
              type="text"
              placeholder="Search AUR packages…"
              value={query}
              onChange={e => { setQuery(e.target.value); setView('explore'); }}
              autoFocus
            />
          </div>
          <div className="header-actions">
            <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name-desc">Sort: Relevance</option>
              <option value="popularity">Sort: Popularity</option>
              <option value="votes">Sort: Votes</option>
              <option value="lastmodified">Sort: Updated</option>
            </select>
            <button className="header-btn" title="Refresh" onClick={() => { getInstalled().then(({ aur, allInstalled }) => { setInstalled(new Set(allInstalled)); setAurInstalled(aur); }); getUpdates().then(({ updates }) => setUpdates(updates || [])); }}>↺</button>
          </div>
        </div>

        {/* Content */}
        <div className="content" style={{ paddingBottom: termOpen ? 268 : 24 }}>

          {/* Installed Tab */}
          {view === 'installed' && !isSearching && (
            <InstalledTab
              packages={aurInstalled}
              installed={installed}
              onSelect={setSelectedPkg}
              onQuickInstall={handleQuickInstall}
            />
          )}

          {/* Updates Tab */}
          {view === 'updates' && !isSearching && (
            <UpdatesTab
              updates={updates}
              installed={installed}
              onInstallStart={handleInstallStart}
              onInstallDone={handleInstallDone}
              addToast={addToast}
              openTerminal={() => setTermOpen(true)}
            />
          )}

          {/* Explore / Featured */}
          {showExplore && (
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
                    <div className="section-title">Picked For You</div>
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

              <div className="empty-state" style={{ opacity: 0.4, padding: 20 }}>
                <div style={{ fontSize: 13 }}>Search for any AUR package above to discover and install it.</div>
              </div>
            </>
          )}

          {/* Search results */}
          {showSearch && (
            <div>
              <div className="section-header">
                <div className="section-title">Results for "{query}"</div>
                {!loading && <div className="section-count">{results.length} packages</div>}
                {loading && <div className="spinner" />}
              </div>
              {results.length === 0 && !loading ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <div className="empty-title">No packages found</div>
                  <div className="empty-desc">Try a different search term or check the spelling.</div>
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
