import { getPackageIcon, formatNumber } from '../services/aurApi';

export default function AppCard({ pkg, installed, onSelect, onQuickInstall }) {
  const isInstalled = installed.has(pkg.Name);
  const icon = getPackageIcon(pkg.Name);

  const handleInstallClick = (e) => {
    e.stopPropagation();
    onQuickInstall(pkg);
  };

  return (
    <div className="app-card" onClick={() => onSelect(pkg)}>
      <div className="card-top">
        <div className={`card-icon ${isInstalled ? 'installed-icon' : ''}`}>{icon}</div>
        <div className="card-title-block">
          <div className="card-name">{pkg.Name}</div>
          <div className="card-version">v{pkg.Version}</div>
        </div>
        {pkg.OutOfDate && (
          <span className="chip chip-amber" style={{ fontSize: 10 }}>⚠</span>
        )}
      </div>

      <div className="card-desc">{pkg.Description || 'No description available.'}</div>

      <div className="card-footer">
        <div className="card-stats">
          <div className="stat">
            <span className="stat-icon">⭐</span>
            <span>{formatNumber(pkg.NumVotes)}</span>
          </div>
          <div className="stat">
            <span className="stat-icon">📈</span>
            <span>{pkg.Popularity?.toFixed(1)}</span>
          </div>
        </div>
        {isInstalled ? (
          <button className="btn btn-installed btn-sm" onClick={handleInstallClick}>✓ Installed</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>⬇ Install</button>
        )}
      </div>
    </div>
  );
}
