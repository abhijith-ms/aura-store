import { CATEGORIES } from '../services/aurApi';

const NAV = [
  { id: 'explore', icon: '✦', label: 'Explore' },
  { id: 'trending', icon: '🔥', label: 'Top Charts' },
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

      <div className="nav-section-label">Discover</div>
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

      <div className="nav-section-label" style={{ marginTop: 10 }}>Categories</div>
      {CATEGORIES.map(cat => (
        <div
          key={cat.id}
          className={`nav-item ${active === cat.id ? 'active' : ''}`}
          onClick={() => onNav(cat.id)}
        >
          <span className="nav-icon">{cat.icon}</span>
          {cat.label}
        </div>
      ))}

      <div className="sidebar-bottom">
        <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Search</span>
          <kbd style={{ background: 'var(--fill-quaternary)', border: '1px solid var(--separator)', borderRadius: 4, padding: '2px 5px', fontSize: 10, fontFamily: 'monospace' }}>⌘K</kbd>
        </div>
        <div className="nav-item" style={{ opacity: 0.7, cursor: 'default', marginTop: 4, padding: '6px 10px', fontSize: 12 }}>
          <span className="nav-icon" style={{ fontSize: 12 }}>⚡</span>
          <span style={{ fontSize: 11, color: 'var(--label-secondary)' }}>Backend: paru / AUR v5</span>
        </div>
      </div>
    </nav>
  );
}
