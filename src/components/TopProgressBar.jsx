import { useMemo, useState } from 'react';
import { ArrowDown, X, ChevronUp, ChevronDown } from 'lucide-react';
import AppIcon from './AppIcon';
import { formatBytes } from '../services/aurApi';

export default function TopProgressBar({
  active,
  pkgName,
  batchIndex = 0,
  batchTotal = 0,
  batchTotalSize = 0,
  action = 'install',
  opState = 'resolving',
  metrics = {},
  logs = [],
  queuedOps = [],
  onCancelQueued,
  onCancel,
  onToggleTerminal,
  terminalOpen,
}) {
  const [queueOpen, setQueueOpen] = useState(false);
  const parsedStatus = useMemo(() => {
    let phase = 'Processing…';
    if (opState === 'resolving') phase = 'Resolving package dependencies';
    else if (opState === 'downloading') phase = 'Retrieving source archives';
    else if (opState === 'building') phase = 'Compiling & building via makepkg';
    else if (opState === 'installing') phase = 'Finalizing installation via pacman';
    else if (opState === 'cancelled') phase = 'Operation cancelled';
    else if (opState === 'failed') phase = 'Build failed';
    else if (opState === 'completed') phase = 'Completed';

    if (action === 'remove') phase = 'Removing package via pacman';

    const speed = metrics.speed || '';
    const downloaded = metrics.downloaded || '';
    const percent = metrics.percent || 0;

    return { phase, speed, downloaded, percent };
  }, [opState, metrics, action]);

  if (!active) return null;

  const isBatch = batchTotal > 1;
  const hasQueue = queuedOps.length > 0;

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
                  ({batchIndex + 1} of {batchTotal}{batchTotalSize > 0 && ` · ${formatBytes(batchTotalSize)} total`})
                </span>
              )}
              {hasQueue && (
                <button
                  type="button"
                  className="top-progress-queue-toggle"
                  onClick={() => setQueueOpen(o => !o)}
                  title="View queued operations"
                >
                  +{queuedOps.length} queued
                </button>
              )}
            </div>
            <div className="top-progress-phase">
              <span className="top-progress-pulse-dot" />
              <span>{parsedStatus.phase}</span>
              {parsedStatus.downloaded && <span>({parsedStatus.downloaded})</span>}
            </div>
          </div>
        </div>

        {/* Right: Network Speed, Percent, Cancel & Terminal Toggle */}
        <div className="top-progress-right">
          {parsedStatus.speed && (
            <div className="top-progress-speed" title="Measured Download Rate">
              <span className="top-progress-speed-icon" style={{ display: 'inline-flex' }}><ArrowDown size={11} strokeWidth={2.5} /></span>
              <span>{parsedStatus.speed}</span>
            </div>
          )}

          {parsedStatus.percent > 0 && (
            <div className="top-progress-percent">
              {parsedStatus.percent}%
            </div>
          )}

          <button
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            title="Cancel installation"
            style={{ padding: '3px 8px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <X size={11} strokeWidth={2} /> Cancel
          </button>

          <button
            className={`btn btn-ghost btn-sm ${terminalOpen ? 'active' : ''}`}
            onClick={onToggleTerminal}
            title="Toggle build terminal output"
            style={{ padding: '3px 8px', fontSize: 11, gap: 4 }}
          >
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>$_</span>
            <span>Logs</span>
            <span style={{ display: 'inline-flex' }}>{terminalOpen ? <ChevronUp size={10} strokeWidth={2} /> : <ChevronDown size={10} strokeWidth={2} />}</span>
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

      {queueOpen && hasQueue && (
        <div className="top-progress-queue-panel">
          {queuedOps.map((item) => (
            <div className="top-progress-queue-item" key={item.queueId}>
              <span>{item.action === 'remove' ? 'Remove' : 'Install'}: {item.displayName}</span>
              <button
                type="button"
                className="top-progress-queue-item-cancel"
                onClick={() => onCancelQueued && onCancelQueued(item.queueId)}
                title="Remove from queue"
              >
                <X size={11} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
