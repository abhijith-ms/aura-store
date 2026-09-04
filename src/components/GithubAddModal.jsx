import { useState, useRef, useEffect } from 'react';
import { GitBranch, X } from 'lucide-react';
import { lookupGithubRelease } from '../services/aurApi';

function parseOwnerRepo(input) {
  const trimmed = input.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

export default function GithubAddModal({ onClose, onFound }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const parsed = parseOwnerRepo(input);
    if (!parsed) {
      setError('Enter as owner/repo or a github.com/owner/repo URL');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await lookupGithubRelease(parsed.owner, parsed.repo);
      onFound(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh',
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20,
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="detail-section"
        style={{ width: '100%', maxWidth: 420, background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
            <GitBranch size={16} strokeWidth={2} /> Add from GitHub Releases
          </div>
          <button className="header-btn" onClick={onClose} style={{ display: 'inline-flex' }}><X size={15} strokeWidth={2} /></button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Any repo whose latest release publishes a Linux .AppImage. Installs like AppImageHub apps do — no dependencies, no sandboxing.
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="search-input"
            style={{ width: '100%', marginBottom: 8 }}
            type="text"
            placeholder="owner/repo or https://github.com/owner/repo"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()} style={{ width: '100%' }}>
            {loading ? 'Looking up…' : 'Look up'}
          </button>
        </form>
      </div>
    </div>
  );
}
