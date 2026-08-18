import { CATEGORIES } from '../services/aurApi';
import { useTheme } from '../context/ThemeContext';

const NAV = [
  { id: 'explore', icon: '✦', label: 'Explore' },
  { id: 'installed', icon: '✓', label: 'Installed' },
  { id: 'updates', icon: '↑', label: 'Updates' },
];

export default function Sidebar({ active, onNav, installedCount, updateCount }) {
  const { themeSetting, cycleTheme } = useTheme();

  const themeLabels = {
    system: 'System Theme',
    dark: 'Dark Mode',
    light: 'Light Mode',
  };

  const themeIcons = {
    system: '💻',
    dark: '🌙',
    light: '☀️',
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">◈</div>
        <div className="sidebar-logo-text">Aura Store</div>
      </div>

      <div className="nav-section-label">Discover</div>
      {NAV.map(item => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNav(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
          {item.id === 'installed' && installedCount > 0 && (
            <span className="badge green">{installedCount}</span>
          )}
          {item.id === 'updates' && updateCount > 0 && (
            <span className="badge">{updateCount}</span>
          )}
        </div>
      ))}

      <div className="nav-section-label" style={{ marginTop: 14 }}>Categories</div>
      {CATEGORIES.map(cat => (
        <div
          key={cat.id}
          className={`nav-item ${active === cat.id ? 'active' : ''}`}
          onClick={() => onNav(cat.id)}
        >
          <span className="nav-icon">{cat.icon}</span>
          <span>{cat.label}</span>
        </div>
      ))}

      <div className="sidebar-bottom">
        <button
          className="theme-toggle-btn"
          onClick={cycleTheme}
          title="Toggle theme (System / Dark / Light)"
        >
          <span>{themeIcons[themeSetting]} {themeLabels[themeSetting]}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>⇄</span>
        </button>

        <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span>Search</span>
          <kbd style={{ background: 'var(--surface-active)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>Ctrl K</kbd>
        </div>

        <div className="nav-item" style={{ opacity: 0.7, cursor: 'default', padding: '4px 8px', fontSize: 11.5 }}>
          <span className="nav-icon" style={{ fontSize: 12 }}>⚡</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>paru / AUR v5</span>
        </div>
      </div>
    </nav>
  );
}
