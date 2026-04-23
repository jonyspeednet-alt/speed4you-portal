import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../../hooks';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/movies', label: 'Movies' },
  { path: '/series', label: 'Series' },
  { path: '/tv', label: 'Live TV' },
  { path: '/browse', label: 'Discover' },
  { path: '/watchlist', label: 'Watchlist' },
];

function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { isSmallMobile } = useBreakpoint();
  const primaryItems = navItems.slice(0, 4);
  const secondaryItems = navItems.slice(4);

  return (
    <>
      <button onClick={() => setIsOpen(true)} style={styles.menuBtn} aria-label="Open menu">
        <span style={styles.menuBtnLabel}>Browse</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>

      {isOpen && (
        <div style={styles.overlay} onClick={() => setIsOpen(false)}>
          <div style={{ ...styles.menu, ...(isSmallMobile ? styles.menuCompact : {}) }} onClick={(event) => event.stopPropagation()}>
            <div style={styles.handle} />
            <div style={styles.topRow}>
              <div style={styles.logo}>
                <span style={styles.logoBadge}>ISP</span>
                <div>
                  <span style={styles.logoText}>Entertainment Portal</span>
                  <span style={styles.logoSub}>Curated local streaming</span>
                </div>
              </div>

              <button onClick={() => setIsOpen(false)} style={styles.closeBtn} aria-label="Close menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>

            <div style={styles.menuCta}>
              <strong style={styles.menuHeadline}>Watch faster on mobile.</strong>
              <span>Quick jumps, cleaner shelves, and faster channel access.</span>
            </div>

            <div style={styles.sectionLabel}>Primary</div>
            <ul style={styles.gridList}>
              {primaryItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      style={{
                        ...styles.navLink,
                        ...(isActive ? styles.navLinkActive : {}),
                      }}
                    >
                      <span style={styles.navLinkIcon}>{item.label.charAt(0)}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div style={styles.sectionLabel}>Library</div>
            <ul style={styles.navList}>
              {secondaryItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setIsOpen(false)}
                      style={{
                        ...styles.navLinkRow,
                        ...(isActive ? styles.navLinkActive : {}),
                      }}
                    >
                      <span>{item.label}</span>
                      <span style={styles.navArrow}>Open</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  menuBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  menuBtnLabel: {
    fontSize: '0.86rem',
    fontWeight: '700',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3, 9, 19, 0.76)',
    backdropFilter: 'blur(6px)',
    zIndex: 2000,
  },
  menu: {
    position: 'absolute',
    left: '10px',
    right: '10px',
    bottom: '10px',
    padding: '16px 16px 22px',
    borderRadius: '30px',
    background: 'linear-gradient(180deg, rgba(13,26,43,0.96), rgba(7,17,31,0.96))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-card)',
  },
  menuCompact: {
    left: '8px',
    right: '8px',
    bottom: '8px',
    padding: '14px 14px 18px',
    borderRadius: '22px',
  },
  handle: {
    width: '44px',
    height: '4px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.18)',
    margin: '0 auto 14px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  closeBtn: {
    color: 'var(--text-secondary)',
    padding: '6px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    color: '#fff',
    fontSize: '0.72rem',
    letterSpacing: '0.16em',
    borderRadius: '16px',
    padding: '0.52rem 0.7rem',
    background: 'linear-gradient(135deg, var(--accent-red), #ff9151)',
  },
  logoText: {
    display: 'block',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  logoSub: {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    marginTop: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '700',
  },
  menuCta: {
    marginTop: '18px',
    marginBottom: '18px',
    padding: '14px 16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    display: 'grid',
    gap: '4px',
  },
  menuHeadline: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
  },
  sectionLabel: {
    marginBottom: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.68rem',
    fontWeight: '800',
  },
  gridList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginBottom: '18px',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  navLink: {
    display: 'grid',
    gap: '8px',
    minHeight: '96px',
    padding: '14px',
    color: 'var(--text-secondary)',
    borderRadius: '18px',
    fontSize: '0.98rem',
    fontWeight: '700',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
  },
  navLinkRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '14px 16px',
    color: 'var(--text-secondary)',
    borderRadius: '18px',
    fontSize: '0.98rem',
    fontWeight: '700',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
  },
  navLinkIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '14px',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--accent-cyan)',
    fontSize: '0.9rem',
  },
  navArrow: {
    color: 'var(--text-muted)',
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
};

export default MobileNav;
