import { formatNumber, getAppDisplayName } from '../services/aurApi';
import AppIcon from './AppIcon';

export default function AppCard({ pkg, installed, onSelect, onQuickInstall, index = 0, isTopMatch = false }) {
  const isInstalled = installed.has(pkg.Name);
  const displayName = getAppDisplayName(pkg.Name);
  const isCustomName = displayName !== pkg.Name;

  const handleInstallClick = (e) => {
    e.stopPropagation();
    onQuickInstall(pkg);
  };

  return (
    <div
      className={`app-card ${isTopMatch ? 'app-card-top-match' : ''}`}
      style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
      onClick={() => onSelect(pkg)}
    >
      <div className="card-top">
        <AppIcon pkgName={pkg.Name} size="md" installed={isInstalled} />
        <div className="card-title-block">
          <div className="card-name">{displayName}</div>
          <div className="card-version">
            {isCustomName ? pkg.Name : `v${pkg.Version}`}
          </div>
        </div>
        {pkg.OutOfDate && (
          <span className="chip chip-orange" style={{ fontSize: 10 }} title="Flagged out of date in AUR">⚠</span>
        )}
      </div>

      <div className="card-desc">{pkg.Description || 'No description available in AUR.'}</div>

      <div className="card-footer">
        <div className="card-stats">
          <div className="stat" title="AUR Votes">
            <span>★</span>
            <span>{formatNumber(pkg.NumVotes)}</span>
          </div>
          <div className="stat" title="Popularity Score">
            <span>📈</span>
            <span>{pkg.Popularity ? pkg.Popularity.toFixed(1) : '0'}</span>
          </div>
        </div>
        {isInstalled ? (
          <button className="btn btn-installed btn-sm" onClick={handleInstallClick}>✓ Installed</button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>Install</button>
        )}
      </div>
    </div>
  );
}
