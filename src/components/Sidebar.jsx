import { CATEGORIES } from '../services/aurApi';

const NAV = [
  { id: 'explore', icon: '✦', label: 'Explore' },
  { id: 'trending', icon: '🔥', label: 'Trending' },
  { id: 'installed', icon: '✓', label: 'Installed' },
  { id: 'updates', icon: '↑', label: 'Updates' },
];

export default function Sidebar({ active, onNav, installedCount, updateCount }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">◈</div>
        <div className="sidebar-logo-text">Aura Store</div>
      </div>

      <div className="nav-section-label">Navigate</div>
      {NAV.map(item => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNav(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
          {item.id === 'installed' && installedCount > 0 && (
            <span className="badge green">{installedCount}</span>
          )}
          {item.id === 'updates' && updateCount > 0 && (
            <span className="badge">{updateCount}</span>
          )}
        </div>
      ))}

      <div className="nav-section-label" style={{ marginTop: 8 }}>Categories</div>
      {CATEGORIES.map(cat => (
        <div
          key={cat.id}
          className={`nav-item ${active === cat.id ? 'active' : ''}`}
          onClick={() => onNav(cat.id, cat.query)}
        >
          <span className="nav-icon">{cat.icon}</span>
          {cat.label}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="nav-item" style={{ opacity: 0.6, cursor: 'default' }}>
          <span className="nav-icon">🐧</span>
          CachyOS / Arch
        </div>
      </div>
    </nav>
  );
}
