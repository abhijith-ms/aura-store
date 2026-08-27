import { useState, useEffect } from 'react';
import { resolvePackageLogo } from '../services/iconRegistry';
import { getPackageIcon, getSystemIconUrl } from '../services/aurApi';

export default function AppIcon({
  pkgName,
  iconName = null,
  iconUrl = null, // Direct hosted icon (e.g. Flathub) — takes priority when provided
  size = 'md', // 'sm' (24px), 'md' (48px), 'lg' (68px), 'hero' (76px)
  installed = false,
  className = '',
}) {
  const [directIconError, setDirectIconError] = useState(false);
  const [systemIconError, setSystemIconError] = useState(false);
  const [cdnIconError, setCdnIconError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const systemIconUrl = !systemIconError ? getSystemIconUrl(iconName, pkgName) : null;
  const logoInfo = !cdnIconError ? resolvePackageLogo(pkgName) : null;
  const fallbackIcon = getPackageIcon(pkgName || '');

  useEffect(() => {
    setDirectIconError(false);
    setSystemIconError(false);
    setCdnIconError(false);
    setLoaded(false);
  }, [pkgName, iconName, iconUrl]);

  const sizeClasses = {
    sm: 'app-icon-sm',
    md: 'app-icon-md',
    lg: 'app-icon-lg',
    hero: 'app-icon-hero',
  };

  const containerClass = `app-icon-container ${sizeClasses[size] || 'app-icon-md'} ${
    installed ? 'installed-icon' : ''
  } ${className}`;

  // 0. Direct hosted icon URL (e.g. Flathub) — the most authoritative source when known
  if (iconUrl && !directIconError) {
    return (
      <div className={containerClass} style={{ backgroundColor: 'var(--fill-tertiary)' }}>
        <img
          src={iconUrl}
          alt={`${pkgName} icon`}
          className={`app-icon-img ${loaded ? 'loaded' : 'loading'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setDirectIconError(true);
            setLoaded(false);
          }}
          loading="lazy"
        />
        {!loaded && (
          <span className="app-icon-fallback-emoji" style={{ opacity: 0.6 }}>
            {fallbackIcon}
          </span>
        )}
      </div>
    );
  }

  // 1. Try local system icon (via backend streaming endpoint)
  if (systemIconUrl && !systemIconError) {
    return (
      <div
        className={containerClass}
        style={{
          backgroundColor: logoInfo?.bg || 'var(--fill-tertiary)',
        }}
      >
        <img
          src={systemIconUrl}
          alt={`${pkgName} system icon`}
          className={`app-icon-img ${loaded ? 'loaded' : 'loading'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setSystemIconError(true);
            setLoaded(false);
          }}
          loading="lazy"
        />
        {!loaded && (
          <span className="app-icon-fallback-emoji" style={{ opacity: 0.6 }}>
            {fallbackIcon}
          </span>
        )}
      </div>
    );
  }

  // 2. Fallback to curated SimpleIcons CDN logo
  if (logoInfo && !cdnIconError) {
    return (
      <div
        className={containerClass}
        style={{
          backgroundColor: logoInfo.bg || 'var(--fill-tertiary)',
        }}
      >
        <img
          src={logoInfo.url}
          alt={`${pkgName} logo`}
          className={`app-icon-img ${loaded ? 'loaded' : 'loading'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setCdnIconError(true)}
          loading="lazy"
        />
        {!loaded && !cdnIconError && (
          <span className="app-icon-fallback-emoji" style={{ opacity: 0.6 }}>
            {fallbackIcon}
          </span>
        )}
      </div>
    );
  }

  // 3. Category emoji avatar fallback
  return (
    <div className={containerClass}>
      <span className="app-icon-fallback-emoji">{fallbackIcon}</span>
    </div>
  );
}
