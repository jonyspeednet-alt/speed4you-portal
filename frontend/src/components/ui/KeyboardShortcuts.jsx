import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = [
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['H'], description: 'Go to Home' },
  { keys: ['M'], description: 'Go to Movies' },
  { keys: ['S'], description: 'Go to Series' },
  { keys: ['T'], description: 'Go to Live TV' },
  { keys: ['/'], description: 'Focus search' },
  { keys: ['Esc'], description: 'Close this panel' },
];

function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?') { setOpen((v) => !v); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
      if (open) return;

      if (e.key === 'h' || e.key === 'H') navigate('/');
      else if (e.key === 'm' || e.key === 'M') navigate('/movies');
      else if (e.key === 's' || e.key === 'S') navigate('/series');
      else if (e.key === 't' || e.key === 'T') navigate('/tv');
      else if (e.key === '/') {
        e.preventDefault();
        navigate('/browse');
        setTimeout(() => document.querySelector('input[type="text"], input[type="search"]')?.focus(), 100);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, open]);

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Keyboard Shortcuts</h2>
          <button style={styles.close} onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>
        <ul style={styles.list}>
          {SHORTCUTS.map((s) => (
            <li key={s.description} style={styles.row}>
              <span style={styles.desc}>{s.description}</span>
              <span style={styles.keys}>
                {s.keys.map((k) => <kbd key={k} style={styles.kbd}>{k}</kbd>)}
              </span>
            </li>
          ))}
        </ul>
        <p style={styles.hint}>Press <kbd style={styles.kbd}>?</kbd> anytime to toggle this panel</p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 3000,
    background: 'rgba(3,9,19,0.72)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  panel: {
    width: 'min(480px, 100%)',
    background: 'linear-gradient(180deg, rgba(13,26,43,0.98), rgba(7,17,31,0.98))',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '28px',
    padding: '28px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: { color: 'var(--text-primary)', fontSize: '1.3rem' },
  close: {
    color: 'var(--text-muted)', fontSize: '1.4rem', padding: '4px 10px',
    borderRadius: '10px', background: 'rgba(255,255,255,0.06)',
    minHeight: '36px', minWidth: '36px',
  },
  list: { display: 'grid', gap: '10px', marginBottom: '20px' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  },
  desc: { color: 'var(--text-secondary)', fontSize: '0.9rem' },
  keys: { display: 'flex', gap: '6px' },
  kbd: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '4px 10px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
    color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: '700',
    fontFamily: 'monospace', minWidth: '28px',
  },
  hint: {
    color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center',
  },
};

export default KeyboardShortcuts;
