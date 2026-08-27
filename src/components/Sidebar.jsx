import { useState, useRef, useEffect } from 'react';
import { Compass, Check, ArrowUp, History, Settings as SettingsIcon, Monitor, Moon, Sun, Palette, Zap, ChevronDown } from 'lucide-react';
import { CATEGORIES } from '../services/aurApi';
import { useTheme } from '../context/ThemeContext';

const NAV = [
  { id: 'explore', icon: Compass, label: 'Explore' },
  { id: 'installed', icon: Check, label: 'Installed' },
  { id: 'updates', icon: ArrowUp, label: 'Updates' },
  { id: 'activity', icon: History, label: 'Activity' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];


export default function Sidebar({ active, onNav, installedCount, updateCount }) {
  const { themeSetting, setThemeSetting } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearanceRef = useRef(null);

  const themeLabels = {
    system: 'System',
    dark: 'Dark',
    light: 'Light',
  };

  const themeIcons = {
    system: Monitor,
    dark: Moon,
    light: Sun,
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target)) {
        setAppearanceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img src="/aura-store.png" alt="" className="sidebar-logo-icon" />
        <div className="sidebar-logo-text">Aura Store</div>
      </div>

      <div className="nav-section-label">Discover</div>
      {NAV.map(item => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNav(item.id)}
        >
          <span className="nav-icon"><item.icon size={15} strokeWidth={2} /></span>
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
          <span className="nav-icon"><cat.icon size={15} strokeWidth={2} /></span>
          <span>{cat.label}</span>
        </div>
      ))}

      <div className="sidebar-bottom">
        {/* Appearance Setting Menu */}
        <div className="appearance-control" ref={appearanceRef}>
          <button
            className="appearance-btn"
            onClick={() => setAppearanceOpen(o => !o)}
            title="Appearance setting"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Palette size={13} strokeWidth={2} /> Appearance</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, color: 'var(--text-primary)' }}>
              {(() => { const Icon = themeIcons[themeSetting]; return <Icon size={13} strokeWidth={2} />; })()} {themeLabels[themeSetting]} <ChevronDown size={12} strokeWidth={2} />
            </span>
          </button>

          {appearanceOpen && (
            <div className="appearance-menu">
              {['system', 'light', 'dark'].map(mode => {
                const Icon = themeIcons[mode];
                return (
                  <button
                    key={mode}
                    className={`appearance-option ${themeSetting === mode ? 'active' : ''}`}
                    onClick={() => {
                      setThemeSetting(mode);
                      setAppearanceOpen(false);
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} strokeWidth={2} /> {themeLabels[mode]}</span>
                    {themeSetting === mode && <Check size={12} strokeWidth={2} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="nav-item" style={{ opacity: 0.65, cursor: 'default', padding: '4px 8px', fontSize: 11 }}>
          <span className="nav-icon"><Zap size={12} strokeWidth={2} /></span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>paru / AUR v5</span>
        </div>
      </div>
    </nav>
  );
}
