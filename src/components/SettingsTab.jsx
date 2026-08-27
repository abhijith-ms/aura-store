import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, HardDrive, Package, Gauge, Eraser, Check,
  Settings as SettingsIcon, Moon, Sun,
} from 'lucide-react';
import {
  getStorageMetrics,
  cleanCache,
  cleanOrphans,
  getAppSettings,
  saveAppSettings,
  formatBytes,
} from '../services/aurApi';
import { useTheme } from '../context/ThemeContext';

export default function SettingsTab({ addToast }) {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState(null);
  const [settings, setSettings] = useState({
    aurHelper: 'auto',
    theme: 'dark',
    autoCleanBuildCache: false,
    autoOpenTerminal: false,
    confirmInstalls: true,
    autoCheckUpdates: true,
  });
  const [cleaningAur, setCleaningAur] = useState(false);
  const [cleaningPacman, setCleaningPacman] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [selectedOrphans, setSelectedOrphans] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [storageData, settingsData] = await Promise.all([
        getStorageMetrics(),
        getAppSettings(),
      ]);
      setStorage(storageData);
      setSettings(prev => ({ ...prev, ...settingsData }));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCleanAur = async () => {
    setCleaningAur(true);
    const res = await cleanCache('aur');
    if (res.ok) {
      addToast(`Cleaned ${formatBytes(res.aur?.freedBytes || 0)} from AUR build cache`, 'success');
      setStorage(res.storage);
    } else {
      addToast('Failed to clean AUR build cache', 'error');
    }
    setCleaningAur(false);
  };

  const handleCleanPacman = async () => {
    setCleaningPacman(true);
    const res = await cleanCache('pacman');
    if (res.ok) {
      addToast('Pacman package cache pruned successfully', 'success');
      setStorage(res.storage);
    } else {
      addToast('Failed to prune Pacman cache', 'error');
    }
    setCleaningPacman(false);
  };

  const handleCleanAllOrphans = async () => {
    if (!storage?.orphans || storage.orphans.length === 0) return;
    setCleaningOrphans(true);
    const res = await cleanOrphans(null);
    if (res.ok) {
      addToast(`Removed ${res.removed?.length || 0} orphan package(s)`, 'success');
      loadData();
    } else {
      addToast(res.error || 'Failed to remove orphan packages', 'error');
    }
    setCleaningOrphans(false);
  };

  const handleRemoveSelectedOrphans = async () => {
    if (selectedOrphans.size === 0) return;
    setCleaningOrphans(true);
    const pkgs = Array.from(selectedOrphans);
    const res = await cleanOrphans(pkgs);
    if (res.ok) {
      addToast(`Removed ${res.removed?.length || 0} selected orphan package(s)`, 'success');
      setSelectedOrphans(new Set());
      loadData();
    } else {
      addToast(res.error || 'Failed to remove selected orphan packages', 'error');
    }
    setCleaningOrphans(false);
  };

  const toggleOrphanSelection = (pkgName) => {
    setSelectedOrphans(prev => {
      const next = new Set(prev);
      if (next.has(pkgName)) next.delete(pkgName);
      else next.add(pkgName);
      return next;
    });
  };

  const updateSetting = async (key, val) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    const res = await saveAppSettings({ [key]: val });
    if (res.ok) {
      addToast('Preference saved', 'info');
    }
  };

  if (loading && !storage) {
    return (
      <div className="empty-state" style={{ padding: '60px 0' }}>
        <div className="spinner" />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>Loading system metrics & preferences…</p>
      </div>
    );
  }

  const diskSpace = storage?.diskSpace || { total: 0, used: 0, available: 0, percent: 0 };
  const orphans = storage?.orphans || [];

  return (
    <div className="explore-view" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 className="section-title">Settings & Storage Maintenance</h2>
          <p className="section-subtitle">
            Manage system caches, orphan packages, and app preferences
          </p>
        </div>
        <button className="btn btn-ghost" onClick={loadData} title="Refresh metrics" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} strokeWidth={2} /> Refresh
        </button>
      </div>

      {/* ── Storage Dashboard Grid ── */}
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <HardDrive size={16} strokeWidth={2} /> Storage & System Caches
      </h3>

      <div className="rail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 28 }}>
        {/* AUR Build Cache Card */}
        <div className="app-card" style={{ cursor: 'default' }}>
          <div className="card-top" style={{ alignItems: 'flex-start' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(139, 92, 246, 0.14)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={20} strokeWidth={1.75} />
            </div>
            <div className="card-title-block" style={{ flex: 1 }}>
              <div className="card-name">AUR Build Cache</div>
              <div className="card-version" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {formatBytes(storage?.aurCache?.bytes || 0)}
              </div>
            </div>
          </div>
          <div className="card-desc" style={{ minHeight: 38, fontSize: 12 }}>
            Temporary makepkg clones and compilation trees in <code>~/.cache/paru</code> and <code>~/.cache/yay</code>.
          </div>
          <div className="card-footer" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '7px 12px', fontSize: 12.5 }}
              onClick={handleCleanAur}
              disabled={cleaningAur || (storage?.aurCache?.bytes || 0) === 0}
            >
              {cleaningAur ? 'Cleaning…' : 'Clean Build Cache'}
            </button>
          </div>
        </div>

        {/* Pacman Package Cache Card */}
        <div className="app-card" style={{ cursor: 'default' }}>
          <div className="card-top" style={{ alignItems: 'flex-start' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(23, 147, 209, 0.14)',
                border: '1px solid rgba(23, 147, 209, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HardDrive size={20} strokeWidth={1.75} />
            </div>
            <div className="card-title-block" style={{ flex: 1 }}>
              <div className="card-name">Pacman Download Cache</div>
              <div className="card-version" style={{ color: 'var(--cyan, #06b6d4)', fontWeight: 700 }}>
                {formatBytes(storage?.pacmanCache?.bytes || 0)}
              </div>
            </div>
          </div>
          <div className="card-desc" style={{ minHeight: 38, fontSize: 12 }}>
            Downloaded <code>.pkg.tar.zst</code> packages stored in <code>/var/cache/pacman/pkg</code>.
          </div>
          <div className="card-footer" style={{ marginTop: 12 }}>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', padding: '7px 12px', fontSize: 12.5, borderColor: 'var(--border)' }}
              onClick={handleCleanPacman}
              disabled={cleaningPacman || (storage?.pacmanCache?.bytes || 0) === 0}
            >
              {cleaningPacman ? 'Pruning…' : 'Prune Old Versions'}
            </button>
          </div>
        </div>

        {/* Root Filesystem Meter Card */}
        <div className="app-card" style={{ cursor: 'default' }}>
          <div className="card-top" style={{ alignItems: 'flex-start' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(34, 197, 94, 0.14)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gauge size={20} strokeWidth={1.75} />
            </div>
            <div className="card-title-block" style={{ flex: 1 }}>
              <div className="card-name">Root Disk Usage</div>
              <div className="card-version" style={{ color: 'var(--green, #22c55e)', fontWeight: 700 }}>
                {diskSpace.percent}% used
              </div>
            </div>
          </div>
          <div className="card-desc" style={{ minHeight: 38, fontSize: 12 }}>
            {formatBytes(diskSpace.used)} used of {formatBytes(diskSpace.total)} ({formatBytes(diskSpace.available)} free).
          </div>
          <div className="card-footer" style={{ marginTop: 12 }}>
            <div style={{ width: '100%', height: 8, background: 'var(--surface-sunken)', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${diskSpace.percent}%`,
                  height: '100%',
                  background: diskSpace.percent > 85 ? 'var(--red)' : 'var(--accent)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Orphan Packages Cleaner ── */}
      <div className="detail-section" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eraser size={16} strokeWidth={2} /> Orphan Packages ({orphans.length})
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Unneeded dependencies installed by packages that have since been removed.
            </p>
          </div>
          {orphans.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedOrphans.size > 0 && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={handleRemoveSelectedOrphans}
                  disabled={cleaningOrphans}
                >
                  Remove Selected ({selectedOrphans.size})
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ fontSize: 12 }}
                onClick={handleCleanAllOrphans}
                disabled={cleaningOrphans}
              >
                {cleaningOrphans ? 'Removing…' : 'Remove All Orphans'}
              </button>
            </div>
          )}
        </div>

        {orphans.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Check size={14} strokeWidth={2} /> No orphan packages found. Your system dependencies are clean!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orphans.map((orphan) => (
              <div
                key={orphan.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--surface-sunken)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={selectedOrphans.has(orphan.name)}
                    onChange={() => toggleOrphanSelection(orphan.name)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {orphan.name}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                      v{orphan.version}
                    </span>
                    {orphan.description && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {orphan.description}
                      </div>
                    )}
                  </div>
                </div>
                {orphan.size && (
                  <span className="chip chip-gray" style={{ fontSize: 11 }}>
                    {orphan.size}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preferences & App Settings ── */}
      <div className="detail-section" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingsIcon size={16} strokeWidth={2} /> App Preferences
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preferred AUR Helper */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Preferred AUR Helper</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Command line helper used to resolve, clone, and build AUR PKGBUILDs.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['auto', 'paru', 'yay'].map((h) => {
                const active = settings.aurHelper === h;
                const isInstalled = h === 'auto' || (storage?.helpers && storage.helpers[h]);
                return (
                  <button
                    key={h}
                    className={`chip ${active ? 'chip-purple' : 'chip-gray'}`}
                    style={{
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 500,
                      opacity: isInstalled ? 1 : 0.45,
                    }}
                    onClick={() => updateSetting('aurHelper', h)}
                    title={!isInstalled ? `${h} is not installed on system` : ''}
                  >
                    {h.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-Clean Build Cache Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Auto-Clean Build Cache</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Automatically delete temporary source and build trees immediately after successful installation.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.autoCleanBuildCache)}
              onChange={(e) => updateSetting('autoCleanBuildCache', e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Auto-Check for Updates Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Auto-Check for Updates</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Periodically check for AUR/official package updates while the app is open and show a desktop notification when new ones appear.
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings.autoCheckUpdates)}
              onChange={(e) => updateSetting('autoCheckUpdates', e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </div>

          {/* Theme Preference */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Theme Mode</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Switch between Dark, Light, or follow System appearance.
              </div>
            </div>
            <button className="btn btn-ghost" onClick={toggleTheme} style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {theme === 'dark' ? <><Moon size={14} strokeWidth={2} /> Dark Mode</> : <><Sun size={14} strokeWidth={2} /> Light Mode</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
