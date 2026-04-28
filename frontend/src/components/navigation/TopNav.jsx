import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import ProfileMenu from './ProfileMenu';
import { useBreakpoint } from '../../hooks';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/movies', label: 'Movies' },
  { path: '/series', label: 'Series' },
  { path: '/tv', label: 'Live TV' },
  { path: '/browse', label: 'Browse' },
  { path: '/watchlist', label: 'Watchlist' },
];

function TopNav() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  const { isMobile, isTablet, isSmallMobile, width } = useBreakpoint();
  const isDesktop = !isMobile && !isTablet;
  const isCompactDesktop = isDesktop && width < 1520;
  const isWideDesktop = isDesktop && width >= 1520;
  const isTightDesktop = isDesktop && width < 1380;
  const isVeryTightDesktop = isDesktop && width < 1280;
  const showSubtitle = isDesktop && width >= 1560;
  const showFullSearchText = isDesktop && width >= 1480;
  const showLiveChip = isDesktop && width >= 1600;
  const visibleNavItems = isTightDesktop ? navItems.filter((item) => item.path !== '/watchlist') : navItems;

  const user = (() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className="top-nav-container"
      style={{
        ...styles.nav,
        ...(isMobile ? styles.navMobile : isTablet ? styles.navTablet : {}),
        ...(isScrolled ? styles.navScrolled : {}),
      }}
    >
      <div style={{ ...styles.container, ...(isCompactDesktop ? styles.containerCompactDesktop : {}), ...(isMobile ? styles.containerMobile : {}) }}>
        <Link to="/" style={{ ...styles.logo, ...(isSmallMobile ? styles.logoCompact : {}) }}>
          <span style={styles.logoMark}>S4U</span>
          <div style={{ ...styles.logoCopy, ...(isSmallMobile ? styles.logoCopyCompact : {}) }}>
            <span style={styles.logoTitle}>Entertainment Portal</span>
            {!isSmallMobile && showSubtitle && <span style={styles.logoSubtitle}>Movies, series and live TV in one place</span>}
          </div>
        </Link>

        {!isMobile && (
          <ul style={{ ...styles.links, ...(isTablet ? styles.linksTablet : {}), ...(isCompactDesktop ? styles.linksCompactDesktop : {}) }}>
            {visibleNavItems.map((item) => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="top-nav-link"
                    style={{
                      ...styles.link,
                      ...(isTablet || isCompactDesktop ? styles.linkTablet : {}),
                      ...(isActive ? styles.linkActive : {}),
                      ...(hoveredLink === item.path && !isActive ? styles.linkHover : {}),
                    }}
                    onMouseEnter={() => setHoveredLink(item.path)}
                    onMouseLeave={() => setHoveredLink(null)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {!isMobile && (
          <div style={{ ...styles.actions, ...(isTablet ? styles.actionsTablet : {}), ...(isCompactDesktop ? styles.actionsCompactDesktop : {}) }}>
            <button
              type="button"
              className="top-nav-search"
              style={{
                ...styles.searchButton,
                ...(isCompactDesktop ? styles.searchButtonCompactDesktop : {}),
                ...(isWideDesktop ? styles.searchButtonWideDesktop : {}),
                ...(isVeryTightDesktop ? styles.searchButtonVeryTightDesktop : {}),
              }}
              onClick={() => window.dispatchEvent(new Event('open-global-search'))}
            >
              <span style={styles.searchIconWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <span style={styles.searchText}>
                {isVeryTightDesktop ? '' : isTablet || !showFullSearchText ? 'Search' : 'Search movies, actors, genres'}
              </span>
              {showFullSearchText && !isVeryTightDesktop && <span style={styles.searchHint}>CTRL+K</span>}
            </button>

            {showLiveChip && (
              <Link to="/tv" className="top-nav-button" style={styles.liveChip}>
                <span style={styles.liveDot} />
                <span>Live now</span>
              </Link>
            )}
          </div>
        )}

        <div style={{ ...styles.rightSide, ...(isCompactDesktop ? styles.rightSideCompactDesktop : {}) }}>
          {!isMobile && <ProfileMenu user={user} compact={isCompactDesktop || !showLiveChip} />}
          {isMobile && <MobileNav />}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    top: '18px',
    left: '18px',
    right: '18px',
    zIndex: 1100,
    borderRadius: '30px',
    background: 'rgba(5, 12, 22, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    transition: 'all var(--transition-normal)',
  },
  navTablet: {
    top: '14px',
    left: '14px',
    right: '14px',
  },
  navMobile: {
    top: '10px',
    left: '10px',
    right: '10px',
    borderRadius: '24px',
  },
  navScrolled: {
    top: '10px',
    background: 'rgba(7, 17, 31, 0.9)',
    borderColor: 'var(--border-strong)',
    boxShadow: 'var(--shadow-card)',
  },
  container: {
    minHeight: '74px',
    width: '100%',
    maxWidth: '1720px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '10px 14px 10px 18px',
  },
  containerMobile: {
    minHeight: '62px',
    width: '100%',
    padding: '8px 10px 8px 14px',
  },
  containerCompactDesktop: {
    gap: '10px',
    padding: '10px 12px 10px 14px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexShrink: 0,
    flex: '0 0 auto',
    minWidth: 0,
  },
  logoCompact: {
    gap: '10px',
  },
  logoMark: {
    display: 'grid',
    placeItems: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%)',
    color: '#050c16',
    fontFamily: 'var(--font-family-display)',
    fontSize: '1rem',
    fontWeight: '900',
    letterSpacing: '0.12em',
    boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
  },
  logoCopy: {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
  },
  logoCopyCompact: {
    minWidth: 0,
  },
  logoTitle: {
    color: 'var(--text-primary)',
    fontWeight: '800',
    fontSize: '0.98rem',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoSubtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flex: '0 1 auto',
    justifyContent: 'flex-start',
    minWidth: 0,
    overflow: 'hidden',
  },
  linksTablet: {
    gap: '2px',
    flex: '0 1 auto',
  },
  linksCompactDesktop: {
    gap: '2px',
    flex: '0 1 auto',
    overflow: 'hidden',
  },
  link: {
    padding: '10px 14px',
    borderRadius: '999px',
    color: 'var(--text-secondary)',
    fontSize: '0.86rem',
    fontWeight: '700',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  linkTablet: {
    padding: '8px 10px',
    fontSize: '0.8rem',
  },
  linkActive: {
    color: '#050c16',
    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-secondary) 100%)',
    boxShadow: '0 8px 20px rgba(0, 255, 255, 0.3)',
  },
  linkHover: {
    color: 'var(--text-primary)',
    background: 'rgba(255, 255, 255, 0.06)',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: 'auto',
    flex: '0 0 auto',
    minWidth: 0,
  },
  actionsTablet: {
    gap: '6px',
  },
  actionsCompactDesktop: {
    gap: '6px',
    marginLeft: 'auto',
  },
  searchButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '220px',
    maxWidth: '360px',
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-secondary)',
  },
  searchButtonCompactDesktop: {
    minWidth: '150px',
    maxWidth: '190px',
  },
  searchButtonVeryTightDesktop: {
    minWidth: '52px',
    maxWidth: '52px',
    padding: '8px',
    gap: '0',
  },
  searchButtonWideDesktop: {
    minWidth: '250px',
    maxWidth: '330px',
  },
  searchIconWrap: {
    display: 'grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--accent-secondary)',
    flexShrink: 0,
  },
  searchText: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.84rem',
    fontWeight: '700',
  },
  searchHint: {
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.06em',
  },
  liveChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 14px',
    borderRadius: '999px',
    background: 'rgba(255, 143, 83, 0.12)',
    border: '1px solid rgba(255, 143, 83, 0.22)',
    color: '#ffd8bd',
    fontSize: '0.78rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent-primary)',
    boxShadow: '0 0 0 6px rgba(255, 143, 83, 0.18)',
    animation: 'livePulse 1.8s ease-in-out infinite',
  },
  rightSide: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '12px',
    flex: '0 0 auto',
  },
  rightSideCompactDesktop: {
    marginLeft: '10px',
    flexShrink: 0,
  },
};

export default TopNav;
