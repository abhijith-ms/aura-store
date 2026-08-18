import { useEffect, useRef } from 'react';

export default function TerminalDrawer({ open, onToggle, logs, installing, packageName }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs]);

  const getLineClass = (type) => {
    if (type === 'done') return 'terminal-line success';
    if (type === 'error') return 'terminal-line error';
    if (type === 'status') return 'terminal-line status';
    return 'terminal-line';
  };

  return (
    <div className={`terminal-drawer ${open ? 'open' : ''}`}>
      <div className="terminal-handle" onClick={onToggle}>
        <div className="terminal-dots">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
        </div>
        <div className="terminal-title">
          {installing
            ? `⚡ Installing ${packageName}…`
            : logs.length > 0
              ? `Terminal — ${logs.length} lines`
              : 'Terminal — Ready'}
        </div>
        {installing && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
        <div style={{ fontSize: 12, color: 'var(--label-tertiary)' }}>{open ? '▼' : '▲'}</div>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {logs.length === 0 ? (
          <div className="terminal-line" style={{ opacity: 0.35 }}>
            — Waiting for output… Install a package to see live logs here —
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={getLineClass(log.type)}>
              {log.type === 'status' ? `→ ${log.text}` : log.text}
            </div>
          ))
        )}
        {installing && (
          <div className="terminal-line status" style={{ animation: 'pulse 1s ease infinite' }}>
            ▌
          </div>
        )}
      </div>
    </div>
  );
}
