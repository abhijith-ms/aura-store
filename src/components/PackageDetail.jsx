import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Package, Check, AlertTriangle, TrendingUp, Star, X,
  ChevronDown, ChevronUp, Trash2, Circle, CircleDot, Download, Lock,
  ExternalLink, Copy, Box, FolderX,
} from 'lucide-react';
import { getPkgbuild, openDownloadsFolder, unlockPacman, cleanCache, formatNumber } from '../services/aurApi';
import { getPackageBrandColor } from '../services/iconRegistry';
import { createPackageViewModel } from '../services/packageViewModel';
import AppIcon from './AppIcon';

export default function PackageDetail({
  pkg,
  installed,
  updates = [],
  aurInstalledList = [],
  isInstalling = false,
  opState = 'idle',
  lastError = null,
  installLogs = [],
  onBack,
  onInstallStart,
  onCancel,
  onLaunch,
  onSelectDependency,
  onToggleTerminal,
  addToast,
}) {
  const [showPkgbuild, setShowPkgbuild] = useState(false);
  const [pkgbuild, setPkgbuild] = useState('');
  const [pkgbuildLoading, setPkgbuildLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingInstall, setConfirmingInstall] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const openButtonRef = useRef(null);

  const toggleDropdown = () => {
    if (!openDropdown && openButtonRef.current) {
      const rect = openButtonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpenDropdown(o => !o);
  };

  // Close the portal-rendered dropdown on outside click, since it no longer
  // sits inside the button's own DOM subtree once escaped via createPortal.
  useEffect(() => {
    if (!openDropdown) return;
    const handleClickOutside = (e) => {
      if (openButtonRef.current && !openButtonRef.current.contains(e.target) && !e.target.closest('.command-palette')) {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Normalize raw package object into authoritative view model
  const vm = useMemo(() => {
    return createPackageViewModel(pkg, {
      installedPackages: installed,
      updates,
      aurInstalledList,
      activeOperation: isInstalling ? { pkg: pkg?.Name, state: opState } : null,
    });
  }, [pkg, installed, updates, aurInstalledList, isInstalling, opState]);

  const isOfficial = vm?.source?.type === 'official';
  const isChaoticAur = vm?.source?.type === 'chaotic-aur';
  const isFlathub = vm?.source?.type === 'flathub';
  // Flathub install/uninstall needs the reverse-DNS AppId, not the display name.
  const installTarget = vm ? { Name: vm.name, Source: vm.raw?.Source, AppId: vm.raw?.AppId } : null;

  const brandColor = useMemo(() => {
    return pkg?.Name ? getPackageBrandColor(pkg.Name) : 'var(--accent)';
  }, [pkg]);

  // Map backend operation state to 4-stage stepper
  const stage = useMemo(() => {
    if (!isInstalling) return 0;
    if (opState === 'resolving') return 1;
    if (opState === 'downloading') return 2;
    if (opState === 'building') return 3;
    if (opState === 'installing') return 4;
    return 1;
  }, [isInstalling, opState]);

  if (!vm) {
    return (
      <div className="detail-page">
        <button className="detail-back-btn" onClick={onBack} title="Back (Esc)">
          <ArrowLeft size={14} strokeWidth={2} />
          <span>Back</span>
        </button>
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon"><Package size={28} strokeWidth={1.75} /></div>
          <div className="empty-title">Package unavailable</div>
          <div className="empty-desc">Package information is currently missing or could not be loaded.</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onBack}>
            Back to previous view
          </button>
        </div>
      </div>
    );
  }

  const togglePkgbuild = async () => {
    if (!showPkgbuild && !pkgbuild) {
      setPkgbuildLoading(true);
      const text = await getPkgbuild(vm.name);
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
    onInstallStart(installTarget, vm.state.updateAvailable ? 'update' : 'install');
  };

  const handleRemove = () => {
    onInstallStart(installTarget, 'remove');
  };

  const handleOpenDownloads = async () => {
    await openDownloadsFolder();
    addToast('Opened ~/Downloads folder', 'info');
  };

  const handleUnlockAndRetry = async () => {
    addToast('Attempting to clean pacman lock…', 'info');
    const res = await unlockPacman();
    if (res.ok) {
      addToast('Lock removed. Retrying build…', 'success');
      onInstallStart(installTarget, 'install');
    } else {
      addToast('Failed to remove lock. Sudo permissions required.', 'error');
    }
  };

  const handleCleanBuildCacheAndRetry = async () => {
    addToast('Clearing leftover build folder…', 'info');
    const res = await cleanCache('aur', installTarget?.Name);
    if (res.ok) {
      addToast('Build folder cleared. Retrying…', 'success');
      onInstallStart(installTarget, 'install');
    } else {
      addToast('Failed to clear build folder.', 'error');
    }
  };

  const { runtime: deps, make: makeDeps, optional: optDeps, check: checkDeps } = vm.dependencies;

  return (
    <div className="detail-page" style={{ '--package-accent': brandColor || 'var(--accent)' }}>
      {/* Back Navigation */}
      <button className="detail-back-btn" onClick={onBack} title="Back (Esc)">
        <ArrowLeft size={14} strokeWidth={2} />
        <span>Back</span>
      </button>

      {/* Hero Header */}
      <div className="detail-hero">
        <div className="detail-ambient-glow" />

        <div className="detail-hero-header">
          <AppIcon
            pkgName={vm.name}
            iconName={vm.launch.desktopEntries[0]?.icon || null}
            iconUrl={isFlathub ? vm.raw?.IconUrl : null}
            size="hero"
            installed={vm.state.installed}
          />
          <div className="detail-hero-meta">
            <div className="detail-name">{vm.displayName}</div>
            <div className="detail-pkgname">
              {vm.name} {vm.metadata.version ? `· v${vm.metadata.version}` : ''}
            </div>
            <div className="detail-desc">{vm.description || 'No description provided.'}</div>

            {/* Source & Classification Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
              <span className={`chip ${isChaoticAur ? 'chip-orange' : isOfficial ? 'chip-green' : isFlathub ? 'chip-indigo' : 'chip-purple'}`} title={vm.source.fullName}>
                {vm.source.label}
              </span>
              {isFlathub && vm.metadata.verified && (
                <span className="chip chip-green" title="Verified by the app's developer on Flathub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={2.5} /> Verified</span>
              )}
              {vm.classification.role !== 'general' && (
                <span className="chip chip-gray" title={`Classification: ${vm.classification.label}`}>
                  {vm.classification.label}
                </span>
              )}
              {vm.state.installed && <span className="chip chip-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={11} strokeWidth={2.5} /> Installed</span>}
              {vm.state.updateAvailable && <span className="chip chip-indigo">Update available</span>}
              {vm.metadata.outOfDate && <span className="chip chip-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} strokeWidth={2} /> Out of date in AUR</span>}
            </div>
          </div>
        </div>

        {/* Hero Actions & Community Stats */}
        <div className="detail-hero-actions">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            {isChaoticAur ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Box size={14} strokeWidth={2} style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Community Build</span>
              </div>
            ) : isOfficial ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                <Check size={14} strokeWidth={2.5} style={{ color: 'var(--success)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Signed by {vm.source.label}</span>
              </div>
            ) : isFlathub ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Package size={14} strokeWidth={2} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sandboxed</span>
                </div>
                {vm.metadata.installsLastMonth > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <TrendingUp size={14} strokeWidth={2} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatNumber(vm.metadata.installsLastMonth)}</span>
                    <span>installs/month</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Star size={14} strokeWidth={2} style={{ color: 'var(--warning)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vm.stats.votesFormatted}</span>
                  <span>votes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <TrendingUp size={14} strokeWidth={2} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vm.stats.popularity}</span>
                  <span>popularity</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isInstalling ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="chip chip-indigo" style={{ padding: '6px 12px', fontSize: 12.5, gap: 6 }}>
                  <div className="spinner-apple" /> Building & Installing…
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={onCancel}
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                  title="Cancel this installation"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={13} strokeWidth={2} /> Cancel</span>
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onToggleTerminal}>
                  Logs
                </button>
              </div>
            ) : vm.state.installed ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
                {vm.state.updateAvailable && (
                  <button className="btn btn-primary btn-lg" onClick={() => setConfirmingInstall(true)}>
                    Update to v{vm.metadata.version}
                  </button>
                )}
                {vm.state.launchable && (
                  vm.launch.desktopEntries.length > 1 || vm.launch.desktopEntries[0]?.actions?.length > 0 ? (
                    <div style={{ position: 'relative' }}>
                      <button
                        ref={openButtonRef}
                        className="btn btn-primary btn-lg"
                        onClick={toggleDropdown}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        Open <ChevronDown size={14} strokeWidth={2} />
                      </button>
                      {openDropdown && dropdownPos && createPortal(
                        <div
                          className="command-palette"
                          style={{
                            position: 'fixed',
                            top: dropdownPos.top,
                            right: dropdownPos.right,
                            minWidth: 200,
                            zIndex: 1000,
                          }}
                        >
                          {vm.launch.desktopEntries.flatMap((entry, idx) => [
                            <div
                              key={`entry-${idx}`}
                              className="palette-result"
                              onClick={() => {
                                setOpenDropdown(false);
                                onLaunch(vm.name, entry.name, entry.filename);
                              }}
                            >
                              <div className="palette-result-name">{entry.name}</div>
                            </div>,
                            ...(entry.actions || []).map((action) => (
                              <div
                                key={`entry-${idx}-action-${action.id}`}
                                className="palette-result"
                                onClick={() => {
                                  setOpenDropdown(false);
                                  onLaunch(vm.name, action.name, entry.filename, action.id);
                                }}
                              >
                                <div className="palette-result-name">{entry.name} — {action.name}</div>
                              </div>
                            )),
                          ])}
                        </div>,
                        document.body
                      )}
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => onLaunch(vm.name, vm.displayName, vm.launch.desktopEntries[0]?.filename)}
                    >
                      Open {vm.displayName}
                    </button>
                  )
                )}
                <button className="btn btn-danger btn-lg" onClick={handleRemove} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={15} strokeWidth={2} /> Remove
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setConfirmingInstall(true)}>
                Install {vm.displayName}
              </button>
            )}
          </div>
        </div>

        {/* Live Build Stepper */}
        {isInstalling && (
          <div className="build-tracker">
            <div className={`build-step ${stage >= 1 ? (stage === 1 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{stage > 1 ? <Check size={12} strokeWidth={2.5} /> : <CircleDot size={12} strokeWidth={2} />}</span>
              <span>Resolving package dependencies</span>
            </div>
            <div className={`build-step ${stage >= 2 ? (stage === 2 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{stage > 2 ? <Check size={12} strokeWidth={2.5} /> : stage === 2 ? <CircleDot size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={2} />}</span>
              <span>Retrieving source archives & signatures</span>
            </div>
            <div className={`build-step ${stage >= 3 ? (stage === 3 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{stage > 3 ? <Check size={12} strokeWidth={2.5} /> : stage === 3 ? <CircleDot size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={2} />}</span>
              <span>Compiling & building via makepkg</span>
            </div>
            <div className={`build-step ${stage >= 4 ? (stage === 4 ? 'active' : 'completed') : ''}`}>
              <span className="build-step-bullet">{stage > 4 ? <Check size={12} strokeWidth={2.5} /> : stage === 4 ? <CircleDot size={12} strokeWidth={2} /> : <Circle size={12} strokeWidth={2} />}</span>
              <span>Finalizing installation via pacman</span>
            </div>
          </div>
        )}
      </div>

      {/* Contextual Error Guidance Card */}
      {!isInstalling && lastError && (
        <div className="detail-section" style={{ borderColor: 'var(--warning)', background: 'var(--surface)' }}>
          {lastError.code === 'SOURCE_MISSING_MANUAL_DOWNLOAD' ? (
            <div>
              <div className="detail-section-title">
                <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={15} strokeWidth={2} /> Manual Download Source Required</span>
                <span className="chip chip-orange">Proprietary EULA</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This package requires a source file (<code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{lastError.filename}</code>) that cannot be downloaded automatically. Download it from the vendor portal into your <strong>Downloads</strong> folder, and Aura will link it when you click Retry!
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={handleOpenDownloads}>
                  Open Downloads Folder
                </button>
                <button className="btn btn-primary" onClick={() => onInstallStart(installTarget, 'install')}>
                  Retry Build
                </button>
              </div>
            </div>
          ) : lastError.code === 'PACMAN_LOCKED' ? (
            <div>
              <div className="detail-section-title">
                <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={15} strokeWidth={2} /> Pacman Database Locked</span>
                <span className="chip chip-red">Lock Conflict</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Another process is holding the pacman database lock (<code style={{ fontFamily: 'var(--font-mono)' }}>/var/lib/pacman/db.lck</code>). If no other updater is running, you can unlock it safely.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleUnlockAndRetry}>
                  Clean Lock & Retry
                </button>
              </div>
            </div>
          ) : lastError.code === 'STALE_BUILD_CACHE' ? (
            <div>
              <div className="detail-section-title">
                <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FolderX size={15} strokeWidth={2} /> Leftover Build Folder</span>
                <span className="chip chip-orange">Stale Cache</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                A build folder from a previous interrupted install is still on disk and is blocking a fresh clone. Clearing it is safe and will retry the build.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleCleanBuildCacheAndRetry}>
                  Clean Build Cache & Retry
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="detail-section-title">
                <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={15} strokeWidth={2} /> Couldn't Install {vm.displayName}</span>
                <span className="chip chip-red">{lastError.code || 'BUILD_FAILED'}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {lastError.message || 'The package failed during the compilation or installation process.'}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={onToggleTerminal}>
                  Show Terminal Logs
                </button>
                <button className="btn btn-primary" onClick={() => onInstallStart(installTarget, 'install')}>
                  Retry Build
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightweight Installation Review Dialog */}
      {confirmingInstall && (
        <div className="detail-section" style={{ borderColor: 'var(--accent)', animation: 'fadeIn 0.15s ease' }}>
          <div className="detail-section-title">
            <span>Install {vm.displayName}?</span>
            <span className="chip chip-purple">{vm.source.label}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>{vm.name}</strong> · v{vm.metadata.version}
            </div>
            <div>
              Maintainer: <span style={{ color: 'var(--text-primary)' }}>{vm.metadata.maintainer}</span> · {deps.length} runtime dependencies
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Aura will build and verify this package locally on your system via <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>paru</code>.
            </div>
          </div>

          {showReviewDetails && (
            <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
              <div><strong style={{ color: 'var(--text-muted)' }}>Package Base:</strong> {vm.metadata.packageBase}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>License:</strong> {vm.metadata.license || 'None declared'}</div>
              <div><strong style={{ color: 'var(--text-muted)' }}>Source:</strong> {vm.source.description}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11.5 }}
              onClick={() => setShowReviewDetails(d => !d)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              {showReviewDetails ? 'Hide details' : <>Show details <ChevronDown size={12} strokeWidth={2} /></>}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmingInstall(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmedInstall}>
                Confirm & Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependencies Section (Runtime, Make, Check, Optional) */}
      <div className="detail-section">
        <div className="detail-section-title">
          <span>Dependencies</span>
          <span className="section-count">{deps.length} runtime required</span>
        </div>

        {deps.length > 0 ? (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {deps.map(d => {
                const cleanDep = d.split(/[<>=]/)[0];
                const isDepInstalled = installed.has(cleanDep);
                return (
                  <span
                    key={d}
                    className={`chip ${isDepInstalled ? 'chip-green' : 'chip-indigo'}`}
                    style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title={isDepInstalled ? `${d} (Installed on system)` : `Inspect ${d}`}
                    onClick={() => onSelectDependency && onSelectDependency(cleanDep)}
                  >
                    {isDepInstalled ? <><Check size={11} strokeWidth={2} /> {d}</> : <>{d} <ExternalLink size={11} strokeWidth={2} /></>}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No runtime dependencies declared.</div>
        )}

        {/* Build / Make Dependencies */}
        {makeDeps.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
              Build Dependencies ({makeDeps.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {makeDeps.map(d => (
                <span key={d} className="chip chip-gray" style={{ padding: '3px 8px', fontSize: 11.5 }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Optional Dependencies */}
        {optDeps.length > 0 && (
          <div style={{ marginTop: 12 }}>
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

      {/* Package Information & Upstream Links */}
      <div className="detail-section">
        <div className="detail-section-title">Package Information</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="info-row">
            <span className="info-label">Source / Repository</span>
            <span className="info-value font-mono">{vm.source.label} ({vm.source.fullName})</span>
          </div>

          <div className="info-row">
            <span className="info-label">Package Base</span>
            <span className="info-value font-mono">{vm.metadata.packageBase}</span>
          </div>

          {vm.metadata.version && (
            <div className="info-row">
              <span className="info-label">Version</span>
              <span className="info-value font-mono">{vm.metadata.version}</span>
            </div>
          )}

          <div className="info-row">
            <span className="info-label">Maintainer</span>
            <span className="info-value font-mono">{vm.metadata.maintainer}</span>
          </div>

          {vm.metadata.firstSubmitted && (
            <div className="info-row">
              <span className="info-label">First Submitted</span>
              <span className="info-value">{vm.metadata.firstSubmitted}</span>
            </div>
          )}

          {vm.metadata.lastModified && (
            <div className="info-row">
              <span className="info-label">Last Updated</span>
              <span className="info-value">{vm.metadata.lastModified}</span>
            </div>
          )}

          {vm.metadata.license && (
            <div className="info-row">
              <span className="info-label">License</span>
              <span className="info-value">{vm.metadata.license}</span>
            </div>
          )}

          {vm.upstream.homepage && (
            <div className="info-row">
              <span className="info-label">Upstream Website</span>
              <a className="info-link" href={vm.upstream.homepage} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {vm.upstream.homepage} <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>
          )}

          {vm.upstream.aur && (
            <div className="info-row">
              <span className="info-label">AUR Recipe Page</span>
              <a className="info-link" href={vm.upstream.aur} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                aur.archlinux.org/packages/{vm.name} <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>
          )}

          {vm.upstream.flathub && (
            <div className="info-row">
              <span className="info-label">Flathub Page</span>
              <a className="info-link" href={vm.upstream.flathub} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                flathub.org/apps/{vm.raw?.AppId} <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Build Transparency & PKGBUILD Recipe (AUR-only — official repo packages
          are pre-built signed binaries, not built locally from a fetchable recipe) */}
      {!isOfficial && !isChaoticAur && !isFlathub && (
      <div className="detail-section">
        <div className="detail-section-title" style={{ cursor: 'pointer' }} onClick={togglePkgbuild}>
          <span>Build Transparency & PKGBUILD</span>
          <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {showPkgbuild ? <>Hide PKGBUILD <ChevronUp size={13} strokeWidth={2} /></> : <>Show PKGBUILD <ChevronDown size={13} strokeWidth={2} /></>}
          </button>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
          This package is built locally from its community-maintained AUR PKGBUILD recipe.
        </p>

        {showPkgbuild && (
          <div style={{ marginTop: 8 }}>
            {pkgbuildLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner-apple" /></div>
            ) : pkgbuild ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={handleCopyPkgbuild} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {copied ? <><Check size={13} strokeWidth={2} /> Copied</> : <><Copy size={13} strokeWidth={2} /> Copy PKGBUILD</>}
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
      )}
    </div>
  );
}
