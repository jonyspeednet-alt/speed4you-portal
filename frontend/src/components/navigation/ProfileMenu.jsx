import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function ProfileMenu({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!user) {
    return (
      <Link to="/login" style={styles.loginLink}>
        Sign In
      </Link>
    );
  }

  const initial = user.username?.charAt(0).toUpperCase() || 'U';

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          ...styles.avatar,
          boxShadow: isOpen
            ? '0 0 0 2px rgba(125,249,255,0.5), 0 8px 24px rgba(255,90,95,0.28)'
            : '0 8px 24px rgba(255,90,95,0.22)',
        }}
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {initial}
      </button>

      {isOpen && (
        <div style={styles.menu} role="menu" aria-label="Profile menu">
          <div style={styles.menuHeader}>
            <div style={styles.menuAvatar}>{initial}</div>
            <div style={styles.menuHeaderText}>
              <span style={styles.menuHeaderLabel}>Signed in as</span>
              <strong style={styles.menuHeaderName}>{user.username}</strong>
            </div>
          </div>

          <div style={styles.divider} />

          <Link
            to="/watchlist"
            role="menuitem"
            style={{
              ...styles.item,
              ...(hoveredItem === 'watchlist' ? styles.itemHover : {}),
            }}
            onMouseEnter={() => setHoveredItem('watchlist')}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => setIsOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            My List
          </Link>

          {user.role === 'admin' && (
            <Link
              to="/admin"
              role="menuitem"
              style={{
                ...styles.item,
                ...(hoveredItem === 'admin' ? styles.itemHover : {}),
              }}
              onMouseEnter={() => setHoveredItem('admin')}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => setIsOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
              </svg>
              Admin
            </Link>
          )}

          <div style={styles.divider} />

          <button
            role="menuitem"
            style={{
              ...styles.item,
              ...styles.itemFull,
              ...(hoveredItem === 'signout' ? styles.itemDanger : {}),
            }}
            onMouseEnter={() => setHoveredItem('signout')}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { position: 'relative' },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff9151)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '1rem',
    transition: 'box-shadow 200ms ease, transform 150ms ease',
    cursor: 'pointer',
    border: 'none',
    flexShrink: 0,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 12px)',
    minWidth: '210px',
    padding: '8px',
    borderRadius: '20px',
    background: 'linear-gradient(160deg, rgba(18,32,52,0.97), rgba(7,17,31,0.98))',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
    zIndex: 200,
    animation: 'scaleIn 180ms cubic-bezier(0.34,1.56,0.64,1) both',
    transformOrigin: 'top right',
  },
  menuHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px 12px',
  },
  menuAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff9151)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  menuHeaderText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  menuHeaderLabel: {
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  menuHeaderName: {
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontWeight: '700',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.07)',
    margin: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    textAlign: 'left',
    borderRadius: '12px',
    fontWeight: '600',
    fontSize: '0.88rem',
    transition: 'background 150ms ease, color 150ms ease',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    fontFamily: 'inherit',
  },
  itemFull: { width: '100%' },
  itemHover: {
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-primary)',
  },
  itemDanger: {
    background: 'rgba(239,68,68,0.1)',
    color: '#f87171',
  },
  loginLink: {
    padding: '10px 18px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.88rem',
    transition: 'background 150ms ease',
  },
};

export default ProfileMenu;
