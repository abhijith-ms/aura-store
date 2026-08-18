import { useState, useMemo } from 'react';
import { getPkgbuild, formatNumber, timeAgo, getAppDisplayName } from '../services/aurApi';
import { getPackageBrandColor } from '../services/iconRegistry';
import AppIcon from './AppIcon';

export default function PackageDetail({
  pkg,
  installed,
  isInstalling = false,
  installLogs = [],
  onBack,
  onInstallStart,
  onSelectDependency,
  onToggleTerminal,
  addToast,
}) {
  const [showPkgbuild, setShowPkgbuild] = useState(false);
  const [pkgbuild, setPkgbuild] = useState('');
  const [pkgbuildLoading, setPkgbuildLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingInstall, setConfirmingInstall] = useState(false);

  const isInstalled = installed.has(pkg.Name);
  const displayName = getAppDisplayName(pkg.Name);
  const brandColor = getPackageBrandColor(pkg.Name);

  // Parse active install stage
  const installStage = useMemo(() => {
    if (!isInstalling || !installLogs || installLogs.length === 0) return 0;
    let stage = 1; // 1: Resolving, 2: Fetching, 3: Building, 4: Installing, 5: Done
    const recent = installLogs.slice(-20);
    for (const log of recent) {
      const text = log.text || '';
      if (text.includes('Downloading') || text.includes('Retrieving sources') || text.includes('curl')) {
        stage = Math.max(stage, 2);
      } else if (text.includes('Making package') || text.includes('Compiling') || text.includes('gcc') || text.includes('cargo') || text.includes('ninja') || text.includes('Starting build')) {
        stage = Math.max(stage, 3);
      } else if (text.includes('Installing') || text.includes('pacman -U') || text.includes('authenticat')) {
        stage = Math.max(stage, 4);
      }
    }
    return stage;
  }, [isInstalling, installLogs]);

  const togglePkgbuild = async () => {
    if (!showPkgbuild && !pkgbuild) {
      setPkgbuildLoading(true);
      const text = await getPkgbuild(pkg.Name);
      setPkgbuild(text);
      setPkgbuildLoading(false);
    }
    setShowPkgbuild(prev => !prev);
  };

  const handleCopyPkgbuild = (e) => {
    e.stopPropagation();
    if (!pkgbuild) return;
    navigator.clipboard.writeText(pkgbuild);
    setCopied(true);
    addToast('PKGBUILD copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmedInstall = () => {
    setConfirmingInstall(false);
    onInstallStart(pkg.Name, 'install');
  };

  const handleRemove = () => {
    onInstallStart(pkg.Name, 'remove');
  };

  const deps = pkg.Depends || [];
  const optDeps = pkg.OptDepends || [];

  return (
    <div className="detail-page" style={{ '--package-accent': brandColor || 'var(--accent)' }}>
      {/* Back Navigation */}
      <button className="detail-back-btn" onClick={onBack} title="Back (Esc)">
        <span>←</span>
        <span>Back</span>
      </button>

      {/* Hero Header */}
      <div className="detail-hero">
        <div className="detail-ambient-glow" />

        <div className="detail-hero-header">
          <AppIcon pkgName={pkg.Name} size="hero" installed={isInstalled} />
          <div className="detail-hero-meta">
            <div className="detail-name">{displayName}</div>
            <div className="detail-pkgname">{pkg.Name} · v{pkg.Version}</div>
            <div className="detail-desc">{pkg.Description || 'No description provided in the AUR.'}</div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {isInstalled && <span className="chip chip-green">✓ Installed</span>}
              {pkg.OutOfDate && <span className="chip chip-orange">⚠ Out of Date in AUR</span>}
              {pkg.Popularity > 5 && <span className="chip chip-indigo">★ Popular</span>}
              {pkg.License?.map(l => <span key={l} className="chip chip-gray">{l}</span>)}
            </div>
          </div>
        </div>

        {/* Hero Actions & Stats */}
        <div className="detail-hero-actions">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>★</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(pkg.NumVotes)}</span>
              <span>votes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>📈</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.Popularity ? pkg.Popularity.toFixed(1) : '0'}</span>
              <span>popularity</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isInstalling ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="chip chip-indigo" style={{ padding: '6px 12px', fontSize: 12.5, gap: 6 }}>
                  <div className="spinner-apple" /> Building & Installing…
                </span>
                <button className="btn btn-ghost btn-sm" onClick={onToggleTerminal}>
                  Show Terminal Logs
                </button>
              </div>
            ) : isInstalled ? (
              <>
                <button className="btn btn-installed btn-lg" disabled>✓ Installed</button>
                <button className="btn btn-danger btn-lg" onClick={handleRemove}>
                  🗑 Remove
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setConfirmingInstall(true)}>
                Install {displayName}
              </button>
            )}
          </div>
        </div>

        {/* Live Build Stepper */}
        {isInstalling && (
          <div className="build-tracker">
            <div className={`build-step ${installStage >= 1 ? (installStage === 1 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{installStage > 1 ? '✓' : '●'}</span>
              <span>Resolving package dependencies</span>
            </div>
            <div className={`build-step ${installStage >= 2 ? (installStage === 2 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{installStage > 2 ? '✓' : installStage === 2 ? '●' : '○'}</span>
              <span>Retrieving source archives & signatures</span>
            </div>
            <div className={`build-step ${installStage >= 3 ? (installStage === 3 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{installStage > 3 ? '✓' : installStage === 3 ? '●' : '○'}</span>
              <span>Compiling & building via makepkg</span>
            </div>
            <div className={`build-step ${installStage >= 4 ? (installStage === 4 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{installStage > 4 ? '✓' : installStage === 4 ? '●' : '○'}</span>
              <span>Finalizing installation via pacman</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Review Dialog */}
      {confirmingInstall && (
        <div className="detail-section" style={{ borderColor: 'var(--accent)', animation: 'fadeIn 0.15s ease' }}>
          <div className="detail-section-title">
            <span>Review AUR Package Build</span>
            <span className="chip chip-indigo">paru / makepkg</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            AUR packages are community-maintained recipes. Aura will build and verify this package locally on your Arch system via <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>paru</code>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface-hover)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Package:</span> <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pkg.Name}</span></div>
            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Version:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{pkg.Version}</span></div>
            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Maintainer:</span> <span>{pkg.Maintainer || 'Community'}</span></div>
            <div><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Dependencies:</span> <span>{deps.length} required</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn btn-ghost" onClick={() => setConfirmingInstall(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmedInstall}>
              Confirm & Install
            </button>
          </div>
        </div>
      )}

      {/* Dependencies Section */}
      <div className="detail-section">
        <div className="detail-section-title">
          <span>Dependencies</span>
          <span className="section-count">{deps.length} runtime required</span>
        </div>

        {deps.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {deps.map(d => (
              <span
                key={d}
                className="chip chip-indigo"
                style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12 }}
                title={`Inspect ${d}`}
                onClick={() => onSelectDependency && onSelectDependency(d.split(/[<>=]/)[0])}
              >
                {d} ↗
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No dependencies declared.</div>
        )}

        {optDeps.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
              Optional Dependencies ({optDeps.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {optDeps.map(d => (
                <span key={d} className="chip chip-gray" style={{ padding: '3px 8px', fontSize: 11.5 }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Package Information Section */}
      <div className="detail-section">
        <div className="detail-section-title">Package Information</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            ['Package Base', pkg.PackageBase || pkg.Name],
            ['Version', pkg.Version],
            ['Maintainer', pkg.Maintainer || 'None (Orphaned)'],
            ['First Submitted', timeAgo(pkg.FirstSubmitted)],
            ['Last Updated', timeAgo(pkg.LastModified)],
            ['License', pkg.License?.join(', ') || 'Custom / None'],
          ].map(([label, value]) => (
            <div className="info-row" key={label}>
              <span className="info-label">{label}</span>
              <span className="info-value font-mono">{value}</span>
            </div>
          ))}

          {pkg.URL && (
            <div className="info-row">
              <span className="info-label">Upstream URL</span>
              <a className="info-link" href={pkg.URL} target="_blank" rel="noreferrer">{pkg.URL} ↗</a>
            </div>
          )}

          <div className="info-row">
            <span className="info-label">AUR Page</span>
            <a className="info-link" href={`https://aur.archlinux.org/packages/${pkg.Name}`} target="_blank" rel="noreferrer">
              aur.archlinux.org/packages/{pkg.Name} ↗
            </a>
          </div>
        </div>
      </div>

      {/* Build & Source Information (PKGBUILD) */}
      <div className="detail-section">
        <div className="detail-section-title" style={{ cursor: 'pointer' }} onClick={togglePkgbuild}>
          <span>Build & Source Information</span>
          <button className="btn btn-ghost btn-sm">
            {showPkgbuild ? 'Hide PKGBUILD ▲' : 'Show PKGBUILD ▾'}
          </button>
        </div>

        {showPkgbuild && (
          <div style={{ marginTop: 8 }}>
            {pkgbuildLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner-apple" /></div>
            ) : pkgbuild ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={handleCopyPkgbuild}>
                    {copied ? '✓ Copied' : '📋 Copy PKGBUILD'}
                  </button>
                </div>
                <pre className="code-block">{pkgbuild}</pre>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>PKGBUILD could not be retrieved from AUR cgit.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
