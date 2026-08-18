import { useMemo } from 'react';
import AppIcon from './AppIcon';

export default function TopProgressBar({
  active,
  pkgName,
  batchIndex = 0,
  batchTotal = 0,
  action = 'install',
  logs = [],
  onToggleTerminal,
  terminalOpen,
}) {
  // Parse recent log lines to extract real speed, percent, and phase
  const parsedStatus = useMemo(() => {
    if (!active || !logs || logs.length === 0) {
      return { phase: 'Starting…', speed: '', percent: 0, downloaded: '' };
    }

    let phase = 'Processing…';
    let speed = '';
    let percent = 0;
    let downloaded = '';

    // Search the last 20 logs
    const recent = logs.slice(-20);
    for (let i = recent.length - 1; i >= 0; i--) {
      const line = recent[i].text || '';

      // Check phase
      if (line.includes('Downloading') || line.includes('Retrieving sources') || line.includes('curl') || line.includes('% Total')) {
        phase = 'Downloading sources';
      } else if (line.includes('Making package') || line.includes('Entering fakeroot') || line.includes('Starting build') || line.includes('Compiling') || line.includes('gcc') || line.includes('clang') || line.includes('cargo') || line.includes('ninja')) {
        phase = 'Compiling & Building';
      } else if (line.includes('Compressing package') || line.includes('Tidying install') || line.includes('Generating .PKGINFO')) {
        phase = 'Creating package';
      } else if (line.includes('Installing') || line.includes('pacman -U') || line.includes('Starting package()') || line.includes('authenticat')) {
        phase = 'Finalizing install';
      } else if (line.includes('Starting remove') || line.includes('Removing')) {
        phase = 'Removing package';
      }

      // Check curl progress format: "28 229.6M 28 65.06M ... 16.27M" or "89% 5.6 MB/s"
      const percentMatch = line.match(/(\d{1,3})%/);
      if (percentMatch && !percent) {
        const val = parseInt(percentMatch[1], 10);
        if (val >= 0 && val <= 100) percent = val;
      }

      // Speed match: e.g. "15.8 MB/s", "4.2 MiB/s", "850 kB/s", "12.4M"
      const speedMatch = line.match(/([\d.]+\s*(?:MB\/s|MiB\/s|kB\/s|KB\/s|GB\/s|M(?:\s|$)))/i);
      if (speedMatch && !speed) {
        const s = speedMatch[1].trim();
        speed = s.endsWith('/s') ? s : `${s}B/s`;
      }

      // Size match: "65.06M / 229.6M"
      const sizeMatch = line.match(/([\d.]+[MGK]i?B?)\s+(?:of|\/)\s+([\d.]+[MGK]i?B?)/i);
      if (sizeMatch && !downloaded) {
        downloaded = `${sizeMatch[1]} / ${sizeMatch[2]}`;
      }
    }

    // Do NOT fabricate fake percentages during compilation — keep it honest with indeterminate animation
    return { phase, speed, percent, downloaded };

  }, [active, logs]);



  if (!active) return null;

  const isBatch = batchTotal > 1;

  return (
    <div className="top-progress-bar">
      <div className="top-progress-content">
        {/* Left: Icon & Package Info */}
        <div className="top-progress-left">
          <div className="top-progress-spinner">
            <div className="spinner-apple" />
          </div>
          <AppIcon pkgName={pkgName} size="sm" />
          <div className="top-progress-meta">
            <div className="top-progress-title">
              {action === 'remove' ? 'Removing' : 'Updating'}: <span className="top-progress-name">{pkgName}</span>
              {isBatch && (
                <span className="top-progress-batch-tag">
                  ({batchIndex + 1} of {batchTotal})
                </span>
              )}
            </div>
            <div className="top-progress-phase">
              <span className="top-progress-pulse-dot" />
              <span>{parsedStatus.phase}</span>
              {parsedStatus.downloaded && <span>({parsedStatus.downloaded})</span>}
            </div>
          </div>
        </div>

        {/* Right: Network Speed, Percent & Terminal Toggle */}
        <div className="top-progress-right">
          {parsedStatus.speed && (
            <div className="top-progress-speed" title="Download Rate">
              <span className="top-progress-speed-icon">↓</span>
              <span>{parsedStatus.speed}</span>
            </div>
          )}

          {parsedStatus.percent > 0 && (
            <div className="top-progress-percent">
              {parsedStatus.percent}%
            </div>
          )}

          <button
            className={`btn btn-ghost btn-sm ${terminalOpen ? 'active' : ''}`}
            onClick={onToggleTerminal}
            title="Toggle build terminal output"
            style={{ padding: '3px 8px', fontSize: 11, gap: 4 }}
          >
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>$_</span>
            <span>Logs</span>
            <span style={{ fontSize: 8 }}>{terminalOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* Animated Glowing Progress Line */}
      <div className="top-progress-track">
        <div
          className={`top-progress-indicator ${parsedStatus.percent === 0 ? 'indeterminate' : ''}`}
          style={{ width: parsedStatus.percent > 0 ? `${Math.max(parsedStatus.percent, 8)}%` : '35%' }}
        />
      </div>
    </div>
  );
}
