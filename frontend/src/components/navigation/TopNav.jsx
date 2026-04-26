import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MobileNav from './MobileNav';
import ProfileMenu from './ProfileMenu';
import { useBreakpoint } from '../../hooks';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/movies', label: 'Movies' },
  { path: '/series', label: 'Series' },
  { path: '/tv', label: 'Live TV' },
  { path: '/browse', label: 'Discover' },
  { path: '/watchlist', label: 'Watchlist' },
];

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [hoveredLink, setHoveredLink] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const { isMobile, isTablet, isSmallMobile } = useBreakpoint();

  const user = (() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;
    try { return JSON.parse(storedUser); } catch { return null; }
  })();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 28);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('q', searchText.trim());
    navigate(`/browse${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <nav
      aria-label="Primary"
      style={{
        ...styles.nav,
        ...(isMobile ? styles.navMobile : isTablet ? styles.navTablet : {}),
        ...(isScrolled ? styles.navScrolled : {}),
      }}
    >
      <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : isTablet ? styles.containerTablet : {}) }}>
        <Link to="/" style={{ ...styles.logo, ...(isSmallMobile ? styles.logoCompact : {}) }}>
          <span style={styles.logoBadge}>ISP</span>
          <div style={{ ...styles.logoCopy, ...(isSmallMobile ? styles.logoCopyCompact : {}) }}>
            <span style={styles.logoText}>Entertainment Portal</span>
            {!isSmallMobile && <span style={styles.logoSub}>Premium local streaming</span>}
          </div>
        </Link>

        {!isMobile && (
          <ul style={{ ...styles.navLinks, ...(isTablet ? styles.navLinksTablet : {}) }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    style={{
                      ...styles.navLink,
                      ...(isTablet ? styles.navLinkTablet : {}),
                      ...(isActive ? styles.navLinkActive : {}),
                      ...(hoveredLink === item.path && !isActive ? styles.navLinkHover : {}),
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
          <div style={{ ...styles.commandStrip, ...(isTablet ? styles.commandStripTablet : {}) }}>
            <form
              onSubmit={submitSearch}
              style={{
                ...styles.searchForm,
                ...(isTablet ? styles.searchFormTablet : {}),
                ...(searchFocused ? styles.searchFormFocused : {}),
              }}
              role="search"
              aria-label="Search catalog"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={styles.searchIcon}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={isTablet ? 'Search...' : 'Search movies, series, year...'}
                style={styles.searchInput}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <button type="submit" style={styles.searchSubmit}>Find</button>
            </form>

            {!isTablet && (
              <Link to="/watchlist" style={styles.ctaBtn}>My Queue</Link>
            )}

            {!isTablet && (
              <div style={styles.liveBadge}>
                <span style={styles.liveDot} />
                <span>Live Catalog</span>
              </div>
            )}
          </div>
        )}

        <div style={styles.rightSection}>
          {!isMobile && <ProfileMenu user={user} />}
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
    minHeight: '72px',
    zIndex: 1100,
    borderRadius: '28px',
    background: 'linear-gradient(135deg, rgba(9,20,37,0.78), rgba(9,20,37,0.46))',
    border: '1px solid rgba(255,255,255,0.09)',
    backdropFilter: 'blur(18px)',
    boxShadow: '0 20px 44px rgba(4,10,20,0.26)',
    transition: 'top 0.3s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
    animation: 'fadeUp 420ms ease',
  },
  navTablet: { left: '14px', right: '14px', top: '14px' },
  navMobile: { left: '10px', right: '10px', top: '10px', minHeight: '64px', borderRadius: '22px' },
  navScrolled: {
    top: '12px',
    background: 'linear-gradient(135deg, rgba(7,17,31,0.92), rgba(13,26,43,0.74))',
    borderColor: 'rgba(255,255,255,0.12)',
    boxShadow: '0 20px 46px rgba(4,10,20,0.34)',
  },
  container: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '10px 18px 10px 22px',
    minHeight: '72px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  containerTablet: { padding: '10px 14px 10px 18px', gap: '10px' },
  containerMobile: { minHeight: '64px', padding: '8px 10px 8px 14px', gap: '10px' },
  logo: { display: 'flex', alignItems: 'center', gap: '14px', fontWeight: '700', flexShrink: 0 },
  logoBadge: {
    color: '#fffdf8',
    fontSize: '0.74rem',
    letterSpacing: '0.18em',
    borderRadius: '16px',
    padding: '0.62rem 0.85rem',
    background: 'linear-gradient(135deg, var(--accent-red), #ff9151)',
    boxShadow: '0 10px 24px rgba(255,90,95,0.3)',
    animation: 'glowPulse 3.8s ease-in-out infinite',
  },
  logoCopy: { display: 'grid', gap: '2px' },
  logoCompact: { gap: '10px', minWidth: 0 },
  logoCopyCompact: { minWidth: 0 },
  logoText: {
    color: 'var(--text-primary)',
    fontSize: '0.98rem',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoSub: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  navLinks: { display: 'flex', gap: '6px', flex: 1, justifyContent: 'center', minWidth: 0 },
  navLinksTablet: { gap: '2px', flex: '0 0 auto' },
  navLink: {
    color: 'var(--text-secondary)',
    fontSize: '0.88rem',
    fontWeight: '700',
    padding: '10px 13px',
    borderRadius: '999px',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  navLinkTablet: { fontSize: '0.8rem', padding: '8px 9px' },
  navLinkActive: {
    color: 'var(--text-primary)',
    background: 'rgba(255,255,255,0.1)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
  },
  navLinkHover: {
    color: 'var(--text-primary)',
    background: 'rgba(255,255,255,0.06)',
  },
  commandStrip: { display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' },
  commandStripTablet: { gap: '6px' },
  rightSection: { display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' },
  searchForm: {
    position: 'relative',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    minWidth: '220px',
    maxWidth: '420px',
    flex: '1 1 260px',
    padding: '6px 8px 6px 36px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
  },
  searchFormFocused: {
    background: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(125,249,255,0.4)',
    boxShadow: '0 0 0 3px rgba(125,249,255,0.1)',
  },
  searchFormTablet: { minWidth: '140px', flex: '1 1 160px' },
  searchIcon: { position: 'absolute', left: '14px', color: 'var(--text-muted)' },
  searchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    padding: '8px 10px 8px 0',
  },
  searchSubmit: {
    padding: '9px 14px',
    borderRadius: '999px',
    background: 'rgba(125,249,255,0.12)',
    border: '1px solid rgba(125,249,255,0.2)',
    color: 'var(--accent-cyan)',
    fontSize: '0.78rem',
    fontWeight: '800',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  ctaBtn: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(125,249,255,0.1)',
    border: '1px solid rgba(125,249,255,0.18)',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '700',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontSize: '0.74rem',
    fontWeight: '700',
    whiteSpace: 'nowrap',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent-cyan)',
    boxShadow: '0 0 0 6px rgba(125,249,255,0.14)',
    animation: 'livePulse 1.8s ease-in-out infinite',
  },
};

export default TopNav;
