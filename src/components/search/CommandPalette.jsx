import { useState, useEffect, useRef, useCallback } from 'react';
import { History, ArrowRight } from 'lucide-react';
import AppIcon from '../AppIcon';
import { getAppDisplayName } from '../../services/aurApi';

/**
 * CommandPalette — Inline overlay showing top-ranked search results.
 *
 * Features:
 *   - Shows top 6 results with display name, package name, description
 *   - "Best match" label on #1, "Installed" badge where applicable
 *   - Keyboard navigable: ↑↓ to navigate, Enter to select, Escape to close
 *   - "View all results →" link at bottom
 *   - Click outside or Escape to dismiss
 */
export default function CommandPalette({
  results,        // Array of { package, primaryScore, matchReason }
  visible,
  installed,       // Set<string>
  onSelect,        // (pkg) => void
  onViewAll,       // () => void
  onClose,         // () => void
  loading,
  query,
  recentSearches,  // string[]
  onRecentClick,   // (query) => void
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const paletteRef = useRef(null);
  const MAX_RESULTS = 6;

  const displayResults = results?.slice(0, MAX_RESULTS) || [];

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!visible) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayResults.length > 0 && displayResults[activeIndex]) {
        onSelect(displayResults[activeIndex].package);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [visible, displayResults, activeIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Click outside to close
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target)) {
        // Don't close if clicking the search input itself
        const searchInput = document.querySelector('.search-input');
        if (searchInput && searchInput.contains(e.target)) return;
        onClose();
      }
    };
    // Delay attachment to avoid immediate close from the focus event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // Show recent searches when no query
  const showRecent = (!query || query.trim().length < 2) && recentSearches?.length > 0;

  return (
    <div className="command-palette-overlay">
      <div className="command-palette" ref={paletteRef}>

        {/* Loading state */}
        {loading && query?.trim().length >= 2 && (
          <div className="palette-loading">
            <div className="spinner-apple" />
            <span>Searching AUR…</span>
          </div>
        )}

        {/* Recent searches (when query is empty) */}
        {showRecent && !loading && (
          <div className="palette-section">
            <div className="palette-section-title">Recent</div>
            {recentSearches.map((rq, i) => (
              <div
                key={i}
                className="palette-recent-item"
                onClick={() => onRecentClick(rq)}
              >
                <span className="palette-recent-icon" style={{ display: 'inline-flex' }}><History size={13} strokeWidth={2} /></span>
                <span>{rq}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search results */}
        {!showRecent && !loading && displayResults.length > 0 && (
          <div className="palette-section">
            <div className="palette-section-title">Best Matches</div>
            {displayResults.map((item, i) => {
              const pkg = item.package;
              const displayName = getAppDisplayName(pkg.Name);
              const isInstalled = installed?.has(pkg.Name);
              const isActive = i === activeIndex;
              const isBestMatch = i === 0;

              return (
                <div
                  key={pkg.Name}
                  className={`palette-result ${isActive ? 'palette-result-active' : ''}`}
                  onClick={() => onSelect(pkg)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <AppIcon pkgName={pkg.Name} size="sm" />
                  <div className="palette-result-info">
                    <div className="palette-result-name">
                      {displayName !== pkg.Name ? displayName : pkg.Name}
                    </div>
                    <div className="palette-result-meta">
                      <span className="palette-pkg-name">{pkg.Name}</span>
                      {pkg.Description && (
                        <span className="palette-desc">
                          {pkg.Description.length > 60 ? pkg.Description.slice(0, 60) + '…' : pkg.Description}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="palette-result-badges">
                    {isBestMatch && <span className="chip chip-indigo" style={{ fontSize: 10, padding: '1px 6px' }}>Best match</span>}
                    {isInstalled && <span className="chip chip-green" style={{ fontSize: 10, padding: '1px 6px' }}>Installed</span>}
                  </div>
                </div>
              );
            })}

            {results.length > MAX_RESULTS && (
              <div
                className="palette-view-all"
                onClick={onViewAll}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View all {results.length} results <ArrowRight size={12} strokeWidth={2} />
              </div>
            )}
          </div>
        )}

        {/* No results */}
        {!showRecent && !loading && query?.trim().length >= 2 && displayResults.length === 0 && (
          <div className="palette-empty">
            <div style={{ fontWeight: 600, fontSize: 13 }}>No packages found for "{query}"</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Try a shorter package name, the application's name, or a related keyword.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
