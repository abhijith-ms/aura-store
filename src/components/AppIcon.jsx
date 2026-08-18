import { useState, useEffect } from 'react';
import { resolvePackageLogo } from '../services/iconRegistry';
import { getPackageIcon } from '../services/aurApi';

export default function AppIcon({
  pkgName,
  size = 'md', // 'sm' (24px), 'md' (48px), 'lg' (68px), 'hero' (76px)
  installed = false,
  className = '',
}) {
  const [imageError, setImageError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const logoInfo = resolvePackageLogo(pkgName);
  const fallbackIcon = getPackageIcon(pkgName || '');

  useEffect(() => {
    setImageError(false);
    setLoaded(false);
  }, [pkgName]);

  const sizeClasses = {
    sm: 'app-icon-sm',
    md: 'app-icon-md',
    lg: 'app-icon-lg',
    hero: 'app-icon-hero',
  };

  const containerClass = `app-icon-container ${sizeClasses[size] || 'app-icon-md'} ${
    installed ? 'installed-icon' : ''
  } ${className}`;

  if (!logoInfo || imageError) {
    return (
      <div className={containerClass}>
        <span className="app-icon-fallback-emoji">{fallbackIcon}</span>
      </div>
    );
  }

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
        onError={() => setImageError(true)}
        loading="lazy"
      />
      {!loaded && !imageError && (
        <span className="app-icon-fallback-emoji" style={{ opacity: 0.6 }}>
          {fallbackIcon}
        </span>
      )}
    </div>
  );
}
