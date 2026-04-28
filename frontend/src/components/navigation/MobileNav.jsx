import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBreakpoint } from '../../hooks';

const navItems = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/movies',
    label: 'Movies',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    path: '/tv',
    label: 'Live TV',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
      </svg>
    ),
  },
  {
    path: '/browse',
    label: 'Discover',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    path: '/watchlist',
    label: 'Watchlist',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
  },
];

function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [dragStartY, setDragStartY] = useState(null);
  const [dragDelta, setDragDelta] = useState(0);
  const location = useLocation();
  const { isSmallMobile } = useBreakpoint();
  const menuRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const primaryItems = navItems.slice(0, 4);
  const secondaryItems = navItems.slice(4);

  const closeMenu = () => setIsOpen(false);

  // Focus trap + ESC close
  useEffect(() => {
    if (!isOpen) return;

    const menu = menuRef.current;
    if (!menu) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = menu.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Swipe-to-close
  function handleTouchStart(e) {
    setDragStartY(e.touches[0].clientY);
    setDragDelta(0);
  }

  function handleTouchMove(e) {
    if (dragStartY === null) return;
    const delta = e.touches[0].clientY - dragStartY;
    if (delta > 0) setDragDelta(delta);
  }

  function handleTouchEnd() {
    if (dragDelta > 80) {
      setIsOpen(false);
    }
    setDragStartY(null);
    setDragDelta(0);
  }

  function handleOpenSearch() {
    setIsOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new Event('open-global-search'));
    }, 150);
  }

  const menuTransform = dragDelta > 0 ? `translateY(${dragDelta}px)` : undefined;
  const menuOpacity = dragDelta > 0 ? Math.max(0.4, 1 - dragDelta / 200) : 1;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={styles.menuBtn}
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span style={styles.menuBtnLabel}>Menu</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{ ...styles.overlay, opacity: menuOpacity }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          ...styles.menu,
          ...(isSmallMobile ? styles.menuCompact : {}),
          transform: isOpen
            ? (menuTransform || 'translateY(0)')
            : 'translateY(110%)',
          opacity: isOpen ? menuOpacity : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div style={styles.handle} aria-hidden="true" />

        {/* Top row */}
        <div style={styles.topRow}>
          <div style={styles.logo}>
            <span style={styles.logoBadge} aria-hidden="true">ISP</span>
            <div>
              <span style={styles.logoText}>Entertainment Portal</span>
              <span style={styles.logoSub}>Curated local streaming</span>
            </div>
          </div>
          <button
            ref={firstFocusableRef}
            onClick={closeMenu}
            style={styles.closeBtn}
            aria-label="Close menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Inline search */}
        <div
          onClick={handleOpenSearch}
          style={{ ...styles.searchForm, cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          aria-label="Search catalog"
          onKeyDown={(e) => e.key === 'Enter' && handleOpenSearch()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={styles.searchIcon} aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <div style={{ ...styles.searchInput, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            Search movies, series...
          </div>
        </div>

        {/* Primary nav grid */}
        <div style={styles.sectionLabel} aria-hidden="true">Browse</div>
        <ul style={styles.gridList} role="list">
          {primaryItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  style={{
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  <span style={{ ...styles.navLinkIcon, ...(isActive ? styles.navLinkIconActive : {}) }} aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Secondary nav list */}
        <div style={styles.sectionLabel} aria-hidden="true">Library</div>
        <ul style={styles.navList} role="list">
          {secondaryItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  style={{
                    ...styles.navLinkRow,
                    ...(isActive ? styles.navLinkActive : {}),
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  <span>{item.label}</span>
                  <span style={styles.navArrow} aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Quick actions */}
        <div style={styles.quickActions}>
          <Link to="/browse?sort=trending" style={styles.quickChip} onClick={closeMenu}>
            🔥 Trending
          </Link>
          <Link to="/browse?sort=latest" style={styles.quickChip} onClick={closeMenu}>
            ✨ Latest
          </Link>
          <Link to="/browse?language=Bengali" style={styles.quickChip} onClick={closeMenu}>
            🇧🇩 Bengali
          </Link>
        </div>
      </div>
    </>
  );
}

const styles = {
  menuBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    minHeight: '44px',
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
    transition: 'opacity 280ms ease',
  },
  menu: {
    position: 'fixed',
    left: '10px',
    right: '10px',
    bottom: '10px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '16px 16px 24px',
    borderRadius: '30px',
    background: 'linear-gradient(180deg, rgba(13,26,43,0.85), rgba(5,12,22,0.95))',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
    zIndex: 2001,
    transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 280ms ease',
    willChange: 'transform',
    scrollbarWidth: 'none',
  },
  menuCompact: {
    left: '8px',
    right: '8px',
    bottom: '8px',
    padding: '14px 14px 20px',
    borderRadius: '24px',
  },
  handle: {
    width: '44px',
    height: '4px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.2)',
    margin: '0 auto 16px',
    cursor: 'grab',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '16px',
  },
  closeBtn: {
    color: 'var(--text-secondary)',
    padding: '8px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    minHeight: '44px',
    minWidth: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    color: '#050c16',
    fontSize: '0.72rem',
    letterSpacing: '0.12em',
    fontWeight: '900',
    borderRadius: '14px',
    padding: '0.52rem 0.7rem',
    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-violet))',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
    flexShrink: 0,
  },
  logoText: {
    display: 'block',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.95rem',
  },
  logoSub: {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    marginTop: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '700',
  },
  searchForm: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 12px 0 38px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '18px',
    minHeight: '48px',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    padding: '12px 0',
  },
  searchSubmit: {
    padding: '8px 14px',
    borderRadius: '12px',
    background: 'var(--accent-secondary)',
    color: '#07111f',
    fontWeight: '800',
    fontSize: '0.78rem',
    minHeight: '36px',
  },
  sectionLabel: {
    marginBottom: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.66rem',
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
    gap: '8px',
    marginBottom: '16px',
  },
  navLink: {
    display: 'grid',
    gap: '10px',
    minHeight: '88px',
    padding: '14px',
    color: 'var(--text-secondary)',
    borderRadius: '18px',
    fontSize: '0.95rem',
    fontWeight: '700',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
    transition: 'background 150ms ease, border-color 150ms ease',
  },
  navLinkRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '14px 16px',
    color: 'var(--text-secondary)',
    borderRadius: '16px',
    fontSize: '0.95rem',
    fontWeight: '700',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
    minHeight: '52px',
    transition: 'background 150ms ease',
  },
  navLinkIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.07)',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: '800',
    transition: 'background 150ms ease, color 150ms ease',
  },
  navLinkIconActive: {
    background: 'rgba(121, 228, 255, 0.16)',
    color: 'var(--accent-secondary)',
  },
  navArrow: {
    color: 'var(--text-muted)',
    fontSize: '1rem',
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    flexWrap: 'nowrap',
    paddingBottom: '8px',
    paddingTop: '4px',
    scrollbarWidth: 'none',
  },
  quickChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    fontWeight: '700',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'background 150ms ease, transform 150ms ease',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
};

export default MobileNav;
