import { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 20,
      }}
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="detail-section"
        style={{
          width: '100%',
          maxWidth: 450,
          background: 'var(--surface)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55), 0 0 32px rgba(139, 92, 246, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lock size={20} strokeWidth={2} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16.5, color: 'var(--text-primary)' }}>
              Authentication Required
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              {authRequest.pkg ? `Administrator privileges needed for ${authRequest.pkg}` : 'Administrator privileges required'}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px 0' }}>
          {authRequest.prompt || 'Aura needs permission to install packages and modify system files.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: 22 }}>
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
              {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
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
