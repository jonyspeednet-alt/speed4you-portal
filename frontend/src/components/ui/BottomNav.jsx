import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/movies',
    label: 'Movies',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
  {
    path: '/series',
    label: 'Series',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    path: '/tv',
    label: 'Live TV',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
      </svg>
    ),
  },
  {
    path: '/browse',
    label: 'Search',
    icon: (active) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" fill={active ? 'rgba(255,255,255,0.1)' : 'none'} />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

function BottomNav() {
  const location = useLocation();
  const [pressedItem, setPressedItem] = useState(null);

  if (location.pathname.startsWith('/watch/')) return null;

  return (
    <nav style={styles.nav} aria-label="Bottom navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);
        const isPressed = pressedItem === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            style={{
              ...styles.item,
              ...(isActive ? styles.itemActive : {}),
              transform: isPressed ? 'scale(0.92)' : 'scale(1)',
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            onMouseDown={() => setPressedItem(item.path)}
            onMouseUp={() => setPressedItem(null)}
            onTouchStart={() => setPressedItem(item.path)}
            onTouchEnd={() => setPressedItem(null)}
          >
            <span style={{ ...styles.iconWrap, ...(isActive ? styles.iconWrapActive : {}) }}>
              {item.icon(isActive)}
            </span>
            <span style={{ ...styles.label, ...(isActive ? styles.labelActive : {}) }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1050,
    display: 'flex',
    alignItems: 'stretch',
    background: 'linear-gradient(180deg, rgba(7,17,31,0.9), rgba(5,12,22,0.97))',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.32)',
  },
  item: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '10px 4px 8px',
    color: 'var(--text-muted)',
    minHeight: '58px',
    transition: 'color 180ms ease, transform 120ms ease',
    textDecoration: 'none',
  },
  itemActive: { color: 'var(--accent-cyan)' },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '30px',
    borderRadius: '12px',
    transition: 'background 180ms ease, box-shadow 180ms ease',
  },
  iconWrapActive: {
    background: 'rgba(125,249,255,0.14)',
    boxShadow: '0 0 12px rgba(125,249,255,0.2)',
  },
  label: {
    fontSize: '0.6rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    lineHeight: 1,
    transition: 'color 180ms ease',
  },
  labelActive: { color: 'var(--accent-cyan)' },
};

export default BottomNav;
