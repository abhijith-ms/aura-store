import { useState } from 'react';
import { formatNumber, getAppDisplayName } from '../services/aurApi';
import AppIcon from './AppIcon';

export default function AppCard({ pkg, installed, installedInfo, onSelect, onQuickInstall, onLaunch, index = 0, isTopMatch = false }) {
  const isOfficial = pkg.Source === 'official';
  const isFlathub = pkg.Source === 'flathub';
  // Flathub identifies apps by AppId (org.mozilla.firefox), not the display name.
  const isInstalled = installed.has(isFlathub ? (pkg.AppId || pkg.Name) : pkg.Name);
  const displayName = getAppDisplayName(pkg.Name);
  const isCustomName = displayName !== pkg.Name;
  const [openDropdown, setOpenDropdown] = useState(false);

  const desktopEntries = installedInfo?.get(pkg.Name)?.desktopEntries || [];
  const canLaunch = isInstalled && desktopEntries.length > 0;

  const handleInstallClick = (e) => {
    e.stopPropagation();
    onQuickInstall(pkg);
  };

  const handleLaunchClick = (e, entry, action = null) => {
    e.stopPropagation();
    setOpenDropdown(false);
    onLaunch(pkg.Name, action ? action.name : entry.name, entry.filename, action?.id);
  };

  const hasDropdown = desktopEntries.length > 1 || desktopEntries[0]?.actions?.length > 0;

  return (
    <div
      className={`app-card ${isTopMatch ? 'app-card-top-match' : ''}`}
      style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
      onClick={() => onSelect(pkg)}
    >
      <div className="card-top">
        <AppIcon pkgName={pkg.Name} iconName={desktopEntries[0]?.icon || null} iconUrl={isFlathub ? pkg.IconUrl : null} size="md" installed={isInstalled} />
        <div className="card-title-block">
          <div className="card-name">{displayName}</div>
          <div className="card-version">
            {isFlathub ? pkg.AppId : isCustomName ? pkg.Name : `v${pkg.Version}`}
          </div>
        </div>
        {isOfficial ? (
          <span className="chip chip-green" style={{ fontSize: 10 }} title={`Official Arch repository: ${pkg.Repository}`}>{pkg.Repository}</span>
        ) : isFlathub ? (
          <span className="chip chip-indigo" style={{ fontSize: 10 }} title="Sandboxed app via Flathub">Flathub</span>
        ) : pkg.OutOfDate && (
          <span className="chip chip-orange" style={{ fontSize: 10 }} title="Flagged out of date in AUR">⚠</span>
        )}
      </div>

      <div className="card-desc">{pkg.Description || 'No description available.'}</div>

      <div className="card-footer">
        <div className="card-stats">
          {isOfficial ? (
            <div className="stat" title="Official Arch repository">
              <span>✓</span>
              <span>Official</span>
            </div>
          ) : isFlathub ? (
            <div className="stat" title="Sandboxed via Flatpak">
              <span>📦</span>
              <span>Sandboxed</span>
            </div>
          ) : (
            <>
              <div className="stat" title="AUR Votes">
                <span>★</span>
                <span>{formatNumber(pkg.NumVotes)}</span>
              </div>
              <div className="stat" title="Popularity Score">
                <span>📈</span>
                <span>{pkg.Popularity ? pkg.Popularity.toFixed(1) : '0'}</span>
              </div>
            </>
          )}
        </div>
        {canLaunch ? (
          hasDropdown ? (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); setOpenDropdown(o => !o); }}
              >
                Open ▾
              </button>
              {openDropdown && (
                <div
                  className="command-palette"
                  style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, minWidth: 180, zIndex: 100 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {desktopEntries.flatMap((entry, idx) => [
                    <div key={`entry-${idx}`} className="palette-result" onClick={(e) => handleLaunchClick(e, entry)}>
                      <div className="palette-result-name">{entry.name}</div>
                    </div>,
                    ...(entry.actions || []).map((action) => (
                      <div
                        key={`entry-${idx}-action-${action.id}`}
                        className="palette-result"
                        onClick={(e) => handleLaunchClick(e, entry, action)}
                      >
                        <div className="palette-result-name">{entry.name} — {action.name}</div>
                      </div>
                    )),
                  ])}
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={(e) => handleLaunchClick(e, desktopEntries[0])}>
              Open
            </button>
          )
        ) : isInstalled ? (
          <button className="btn btn-installed btn-sm" onClick={handleInstallClick}>✓ Installed</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>Install</button>
        )}
      </div>
    </div>
  );
}
