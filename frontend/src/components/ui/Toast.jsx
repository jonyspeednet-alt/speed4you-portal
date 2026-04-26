import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext } from './ToastContext';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(({ message, type = 'info', duration = 3500, icon }) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, icon, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    if (navigator.vibrate) navigator.vibrate(8);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TYPE_STYLES = {
  success: {
    bg: 'rgba(22,163,74,0.16)',
    border: 'rgba(34,197,94,0.32)',
    color: '#4ade80',
    icon: '✓',
  },
  error: {
    bg: 'rgba(220,38,38,0.16)',
    border: 'rgba(239,68,68,0.32)',
    color: '#f87171',
    icon: '✕',
  },
  info: {
    bg: 'rgba(125,249,255,0.1)',
    border: 'rgba(125,249,255,0.26)',
    color: 'var(--accent-cyan)',
    icon: 'ℹ',
  },
  warning: {
    bg: 'rgba(255,200,87,0.12)',
    border: 'rgba(255,200,87,0.32)',
    color: 'var(--accent-amber)',
    icon: '!',
  },
};

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 640;
  return (
    <div
      style={{
        ...styles.container,
        ...(isMobileView ? styles.containerMobile : {}),
      }}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const ts = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
  const duration = toast.duration || 3500;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (duration <= 0) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      style={{
        ...styles.toast,
        background: ts.bg,
        borderColor: ts.border,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-16px) scale(0.95)',
        opacity: visible ? 1 : 0,
      }}
      role="alert"
    >
      <span style={{ ...styles.iconWrap, background: ts.border, color: ts.color }}>
        {toast.icon || ts.icon}
      </span>
      <span style={styles.message}>{toast.message}</span>
      <button
        style={styles.close}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      {duration > 0 && (
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%`, background: ts.color }} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 'max(80px, calc(var(--nav-height-desktop) + 16px))',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'flex-end',
    pointerEvents: 'none',
    width: 'min(380px, calc(100vw - 40px))',
  },
  toast: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px 18px',
    borderRadius: '16px',
    border: '1px solid',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    width: '100%',
    pointerEvents: 'auto',
    overflow: 'hidden',
    transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 240ms ease',
  },
  iconWrap: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: '800',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    fontWeight: '600',
    lineHeight: '1.4',
  },
  close: {
    color: 'var(--text-muted)',
    padding: '4px',
    flexShrink: 0,
    minHeight: '28px',
    minWidth: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'background 150ms ease, color 150ms ease',
    cursor: 'pointer',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    transition: 'width 50ms linear',
    opacity: 0.7,
  },
  containerMobile: {
    top: 'auto',
    bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px)',
    right: '12px',
    left: '12px',
    width: 'auto',
    alignItems: 'stretch',
  },
};
