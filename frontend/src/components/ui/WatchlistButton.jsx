import { useEffect, useState } from 'react';
import { watchlistService } from '../../services';
import { useToast } from './useToast';

function WatchlistButton({ contentType, contentId, title, compact = false }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    watchlistService.check(contentType, contentId)
      .then((res) => { if (!cancelled) setSaved(Boolean(res?.inWatchlist)); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [contentType, contentId]);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    if (navigator.vibrate) navigator.vibrate(10);
    try {
      if (saved) {
        await watchlistService.remove(contentId);
        setSaved(false);
        show({ message: 'Removed from My List', type: 'info', icon: '−' });
      } else {
        await watchlistService.add(contentType, contentId);
        setSaved(true);
        show({ message: 'Added to My List', type: 'success', icon: '✓' });
      }
    } catch {
      show({ message: 'Could not update your list', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.compact,
          ...(saved ? styles.compactSaved : {}),
          ...(hovered && !saved ? styles.compactHover : {}),
          boxShadow: hovered && saved ? '0 0 14px var(--glow-cyan)' : 'none',
        }}
        aria-label={saved ? `Remove ${title} from My List` : `Add ${title} to My List`}
        aria-pressed={saved}
        disabled={loading}
      >
        {loading ? (
          <span style={styles.spinner} aria-hidden="true" />
        ) : saved ? (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.btn,
        ...(saved ? styles.btnSaved : {}),
        ...(hovered && !saved ? styles.btnHover : {}),
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered && saved
          ? '0 6px 20px var(--glow-cyan)'
          : hovered
            ? '0 6px 20px rgba(0,0,0,0.25)'
            : 'none',
      }}
      aria-label={saved ? `Remove ${title} from My List` : `Add ${title} to My List`}
      aria-pressed={saved}
      disabled={loading}
    >
      {loading ? (
        <span style={styles.spinner} aria-hidden="true" />
      ) : saved ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
      <span>{saved ? 'In My List' : 'My List'}</span>
    </button>
  );
}

const styles = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 20px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.88rem',
    transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
    minHeight: '44px',
    cursor: 'pointer',
  },
  btnHover: {
    background: 'rgba(255,255,255,0.13)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  btnSaved: {
    background: 'rgba(125,249,255,0.12)',
    borderColor: 'rgba(125,249,255,0.38)',
    color: 'var(--accent-cyan)',
  },
  compact: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'rgba(7,17,31,0.72)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
    cursor: 'pointer',
  },
  compactHover: {
    background: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.24)',
  },
  compactSaved: {
    background: 'rgba(125,249,255,0.18)',
    borderColor: 'rgba(125,249,255,0.42)',
    color: 'var(--accent-cyan)',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    borderTopColor: 'currentColor',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
};

export default WatchlistButton;
