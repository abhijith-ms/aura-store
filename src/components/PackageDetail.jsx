import { useState, useRef, useEffect } from 'react';
import { getPkgbuild, streamInstall, formatNumber, timeAgo, getPackageIcon } from '../services/aurApi';

export default function PackageDetail({ pkg, installed, onClose, onInstallStart, onInstallDone, addToast }) {
  const [tab, setTab] = useState('info');
  const [pkgbuild, setPkgbuild] = useState('');
  const [pkgbuildLoading, setPkgbuildLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [removing, setRemoving] = useState(false);
  const isInstalled = installed.has(pkg.Name);

  const fetchPkgbuild = async () => {
    if (pkgbuild) return;
    setPkgbuildLoading(true);
    const text = await getPkgbuild(pkg.Name);
    setPkgbuild(text);
    setPkgbuildLoading(false);
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === 'pkgbuild') fetchPkgbuild();
  };

  const handleInstall = () => {
    setInstalling(true);
    onInstallStart(pkg.Name, 'install');
    const stop = streamInstall(pkg.Name, 'install', onInstallStart, (ok) => {
      setInstalling(false);
      onInstallDone(pkg.Name, 'install', ok);
      addToast(ok ? `${pkg.Name} installed successfully!` : `Failed to install ${pkg.Name}`, ok ? 'success' : 'error');
    });
  };

  const handleRemove = () => {
    setRemoving(true);
    onInstallStart(pkg.Name, 'remove');
    streamInstall(pkg.Name, 'remove', onInstallStart, (ok) => {
      setRemoving(false);
      onInstallDone(pkg.Name, 'remove', ok);
      addToast(ok ? `${pkg.Name} removed.` : `Failed to remove ${pkg.Name}`, ok ? 'info' : 'error');
    });
  };

  const icon = getPackageIcon(pkg.Name);
  const deps = pkg.Depends || [];
  const optDeps = pkg.OptDepends || [];
  const conflicts = pkg.Conflicts || [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon">{icon}</div>
          <div className="modal-meta">
            <div className="modal-name">{pkg.Name}</div>
            <div className="modal-subtitle">
              v{pkg.Version} · by {pkg.Maintainer || 'Unknown'}
            </div>
            <div className="modal-chips">
              {isInstalled && <span className="chip chip-green">✓ Installed</span>}
              {pkg.OutOfDate && <span className="chip chip-orange">⚠ Out of Date</span>}
              {pkg.Popularity > 5 && <span className="chip chip-indigo">🔥 Popular</span>}
              {pkg.License?.map(l => <span key={l} className="chip chip-gray">{l}</span>)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          {['info', 'deps', 'pkgbuild'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>
              {t === 'info' ? 'Info' : t === 'deps' ? 'Dependencies' : 'PKGBUILD'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="modal-body">
          {tab === 'info' && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-card-value" style={{ color: 'var(--apple-yellow)' }}>⭐ {formatNumber(pkg.NumVotes)}</div>
                  <div className="stat-card-label">Votes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value" style={{ color: 'var(--apple-blue)' }}>📈 {pkg.Popularity?.toFixed(2)}</div>
                  <div className="stat-card-label">Popularity</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-value" style={{ color: 'var(--apple-green)' }}>🕐 {timeAgo(pkg.LastModified)}</div>
                  <div className="stat-card-label">Updated</div>
                </div>
              </div>

              <div style={{ fontSize: 13.5, color: 'var(--label-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
                {pkg.Description || 'No description available.'}
              </div>

              {[
                ['Package', pkg.Name],
                ['Base', pkg.PackageBase],
                ['Version', pkg.Version],
                ['Maintainer', pkg.Maintainer],
                ['Submitted', timeAgo(pkg.FirstSubmitted)],
                ['License', pkg.License?.join(', ')],
                ['AUR Page', pkg.URL ? null : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-value">{value}</span>
                </div>
              ))}
              {pkg.URL && (
                <div className="info-row">
                  <span className="info-label">Homepage</span>
                  <a className="info-link" href={pkg.URL} target="_blank" rel="noreferrer">{pkg.URL}</a>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">AUR</span>
                <a className="info-link" href={`https://aur.archlinux.org/packages/${pkg.Name}`} target="_blank" rel="noreferrer">
                  aur.archlinux.org/packages/{pkg.Name}
                </a>
              </div>
            </>
          )}

          {tab === 'deps' && (
            <>
              {deps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Dependencies ({deps.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {deps.map(d => <span key={d} className="chip chip-indigo">{d}</span>)}
                  </div>
                </div>
              )}
              {optDeps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Optional ({optDeps.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {optDeps.map(d => <span key={d} className="chip chip-gray">{d.split(':')[0]}</span>)}
                  </div>
                </div>
              )}
              {conflicts.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--label-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Conflicts</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {conflicts.map(d => <span key={d} className="chip chip-red">{d}</span>)}
                  </div>
                </div>
              )}
              {deps.length === 0 && optDeps.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <div className="empty-title">No dependency info</div>
                  <div className="empty-desc">Dependency data was not returned from AUR API for this package.</div>
                </div>
              )}
            </>
          )}

          {tab === 'pkgbuild' && (
            pkgbuildLoading
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
              : pkgbuild
                ? <pre className="code-block">{pkgbuild}</pre>
                : <div className="empty-state"><div className="empty-icon">📄</div><div className="empty-title">PKGBUILD not available</div></div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {isInstalled ? (
            <>
              <button className="btn btn-installed btn-lg" disabled>✓ Installed</button>
              <button className="btn btn-danger btn-lg" onClick={handleRemove} disabled={removing}>
                {removing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Removing…</> : '🗑 Remove'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleInstall} disabled={installing}>
              {installing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Installing…</> : `⬇ Install ${pkg.Name}`}
            </button>
          )}
          <button className="btn btn-ghost btn-lg" onClick={onClose} style={{ marginLeft: 'auto' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
