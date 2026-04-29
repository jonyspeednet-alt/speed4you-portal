import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { authService } from '../services';
import { useBreakpoint } from '../hooks';

const NAV = [
  {
    path: '/admin',
    label: 'Dashboard',
    exact: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    path: '/admin/content',
    label: 'Content Library',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    path: '/admin/content/new',
    label: 'Add Content',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    path: '/admin/movies',
    label: 'Movies',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
  {
    path: '/admin/series',
    label: 'Series',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
];

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [authState, setAuthState] = useState(() =>
    localStorage.getItem('token') ? 'checking' : 'unauthenticated'
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    if (authState !== 'checking') return;
    authService.verify()
      .then(() => setAuthState('authenticated'))
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState('unauthenticated');
      });
  }, [authState]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    authService.logout().catch(() => null).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    });
  };

  const pageTitle = useMemo(() => {
    const p = location.pathname;
    if (p.endsWith('/new')) return 'Add Content';
    if (p.includes('/edit')) return 'Edit Content';
    if (p.startsWith('/admin/movies')) return 'Movies';
    if (p.startsWith('/admin/series')) return 'Series';
    if (p.startsWith('/admin/content')) return 'Content Library';
    return 'Dashboard';
  }, [location.pathname]);

  if (authState === 'checking') {
    return (
      <div style={s.authShell}>
        <div style={s.authSpinner} />
        <span style={s.authText}>Verifying session...</span>
      </div>
    );
  }

  if (authState !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={s.root}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <button
          aria-label="Close menu"
          style={s.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        ...s.sidebar,
        ...(isMobile ? s.sidebarMobile : {}),
        ...(isMobile && sidebarOpen ? s.sidebarOpen : {}),
      }}>
        {/* Brand */}
        <div style={s.brand}>
          <div style={s.brandMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div style={s.brandName}>ISP Portal</div>
            <div style={s.brandSub}>Admin</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={s.nav} aria-label="Admin navigation">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && item.path !== '/admin';
            const isExactDashboard = item.exact && location.pathname === '/admin';
            const isActive = isExactDashboard || (!item.exact && location.pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                to={item.path}
                style={{ ...s.navItem, ...(isActive ? s.navItemActive : {}) }}
                aria-current={isActive ? 'page' : undefined}
              >
                <span style={{ ...s.navIcon, ...(isActive ? s.navIconActive : {}) }}>
                  {item.icon}
                </span>
                <span style={s.navLabel}>{item.label}</span>
                {isActive && <span style={s.navDot} />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={s.userSection}>
          <div style={s.userCard}>
            <div style={s.userAvatar}>
              {(user?.username || 'A')[0].toUpperCase()}
            </div>
            <div style={s.userInfo}>
              <span style={s.userName}>{user?.username || 'Admin'}</span>
              <span style={s.userRole}>{user?.role || 'editor'}</span>
            </div>
          </div>
          <div style={s.sidebarActions}>
            <Link to="/" style={s.sidebarLink}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Portal
            </Link>
            <button onClick={handleLogout} style={s.logoutBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={s.main}>
        {/* Top bar */}
        <header style={s.topbar}>
          <div style={s.topbarLeft}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                style={s.menuBtn}
                aria-label="Open menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <h1 style={s.pageTitle}>{pageTitle}</h1>
          </div>
          <div style={s.topbarRight}>
            <Link to="/admin/content/new" style={s.addBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Content
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main style={s.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const SIDEBAR_W = '240px';
const ACCENT = '#6366f1';
const ACCENT_LIGHT = 'rgba(99,102,241,0.12)';
const ACCENT_BORDER = 'rgba(99,102,241,0.3)';
const BG = '#0a0c10';
const SURFACE = '#111318';
const SURFACE2 = '#181b22';
const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';

const s = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: BG,
    color: TEXT,
    fontFamily: 'var(--font-family, system-ui, sans-serif)',
  },

  // Auth loading
  authShell: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    background: BG,
    color: TEXT2,
  },
  authSpinner: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: `2px solid ${BORDER}`,
    borderTopColor: ACCENT,
    animation: 'spin 0.8s linear infinite',
  },
  authText: { fontSize: '0.9rem' },

  // Overlay
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 49,
    border: 'none',
    cursor: 'pointer',
  },

  // Sidebar
  sidebar: {
    width: SIDEBAR_W,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: SURFACE,
    borderRight: `1px solid ${BORDER}`,
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  sidebarMobile: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
    transform: 'translateX(-100%)',
    transition: 'transform 240ms cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
  },
  sidebarOpen: {
    transform: 'translateX(0)',
  },

  // Brand
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 20px 16px',
    borderBottom: `1px solid ${BORDER}`,
  },
  brandMark: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: ACCENT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0,
  },
  brandName: {
    fontSize: '0.95rem',
    fontWeight: '700',
    color: TEXT,
    lineHeight: 1.2,
  },
  brandSub: {
    fontSize: '0.72rem',
    color: TEXT3,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: '2px',
  },

  // Nav
  nav: {
    flex: 1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '8px',
    color: TEXT2,
    fontSize: '0.875rem',
    fontWeight: '500',
    textDecoration: 'none',
    position: 'relative',
    transition: 'background 150ms, color 150ms',
  },
  navItemActive: {
    background: ACCENT_LIGHT,
    color: TEXT,
    fontWeight: '600',
  },
  navIcon: {
    flexShrink: 0,
    opacity: 0.6,
    display: 'flex',
  },
  navIconActive: {
    opacity: 1,
    color: ACCENT,
  },
  navLabel: {
    flex: 1,
  },
  navDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: ACCENT,
    flexShrink: 0,
  },

  // User section
  userSection: {
    padding: '12px 10px 16px',
    borderTop: `1px solid ${BORDER}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '8px',
    background: SURFACE2,
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: ACCENT_LIGHT,
    border: `1px solid ${ACCENT_BORDER}`,
    color: ACCENT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: '700',
    flexShrink: 0,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  userName: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: TEXT,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '0.72rem',
    color: TEXT3,
    textTransform: 'capitalize',
  },
  sidebarActions: {
    display: 'flex',
    gap: '6px',
  },
  sidebarLink: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    borderRadius: '7px',
    background: SURFACE2,
    color: TEXT2,
    fontSize: '0.8rem',
    fontWeight: '500',
    textDecoration: 'none',
    border: `1px solid ${BORDER}`,
  },
  logoutBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px',
    borderRadius: '7px',
    background: 'rgba(239,68,68,0.08)',
    color: '#f87171',
    fontSize: '0.8rem',
    fontWeight: '500',
    border: '1px solid rgba(239,68,68,0.15)',
    cursor: 'pointer',
  },

  // Main area
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },

  // Top bar
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '0 24px',
    height: '60px',
    borderBottom: `1px solid ${BORDER}`,
    background: SURFACE,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    flexShrink: 0,
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  menuBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: SURFACE2,
    border: `1px solid ${BORDER}`,
    color: TEXT2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: TEXT,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    background: ACCENT,
    color: '#fff',
    fontSize: '0.82rem',
    fontWeight: '600',
    textDecoration: 'none',
    flexShrink: 0,
  },

  // Content
  content: {
    flex: 1,
    padding: '24px',
    minWidth: 0,
    overflowX: 'hidden',
  },
};

export default AdminLayout;
