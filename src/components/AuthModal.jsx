import { useState, useEffect, useRef } from 'react';

export default function AuthModal({ authRequest, onRespond }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus password field immediately on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onRespond(authRequest.authId, password, false);
  };

  const handleCancel = () => {
    if (submitting) return;
    onRespond(authRequest.authId, '', true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="command-palette-backdrop" style={{ zIndex: 9999 }} onKeyDown={handleKeyDown}>
      <div
        className="detail-section"
        style={{
          width: '100%',
          maxWidth: 440,
          margin: '12vh auto',
          background: 'var(--surface)',
          borderColor: 'rgba(139, 92, 246, 0.4)',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45), 0 0 24px rgba(139, 92, 246, 0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🔒
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              Authentication Required
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {authRequest.pkg ? `Administrator privileges needed for ${authRequest.pkg}` : 'Administrator privileges required'}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
          {authRequest.prompt || 'Aura needs permission to install packages and modify system files.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter sudo password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="search-input"
              style={{
                width: '100%',
                paddingRight: 40,
                fontSize: 14,
                fontFamily: showPassword ? 'inherit' : 'var(--font-mono)',
                borderColor: 'var(--border)',
              }}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 15,
                opacity: 0.6,
                padding: 4,
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !password.trim()}
              style={{ minWidth: 120 }}
            >
              {submitting ? 'Authenticating…' : 'Authenticate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
