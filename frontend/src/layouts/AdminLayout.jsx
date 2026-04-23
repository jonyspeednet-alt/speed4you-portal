import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { authService } from '../services';
import { useBreakpoint } from '../hooks';

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: 'DB', hint: 'Pulse and analytics' },
  { path: '/admin/content', label: 'Scanner Library', icon: 'SC', hint: 'Drafts, roots, health' },
  { path: '/admin/content/new', label: 'New Entry', icon: 'NW', hint: 'Manual publishing' },
  { path: '/admin/movies', label: 'Movies', icon: 'MV', hint: 'Movie command board' },
  { path: '/admin/series', label: 'Series', icon: 'TV', hint: 'Series command board' },
];

function getSectionMeta(pathname) {
  if (pathname.startsWith('/admin/content/new')) {
    return {
      title: 'Create Entry',
      eyebrow: 'Editorial Studio',
      badge: 'Authoring',
      description: 'Add a polished title, apply metadata, and push it live.',
    };
  }

  if (pathname.startsWith('/admin/content/') && pathname.endsWith('/edit')) {
    return {
      title: 'Review Entry',
      eyebrow: 'Editorial Studio',
      badge: 'Review',
      description: 'Fix metadata, resolve duplicates, and decide publish readiness.',
    };
  }

  if (pathname.startsWith('/admin/content')) {
    return {
      title: 'Scanner Library',
      eyebrow: 'Media Command',
      badge: 'Live Queue',
      description: 'Monitor scanner roots, draft triage, and catalog movement in one place.',
    };
  }

  if (pathname.startsWith('/admin/movies')) {
    return {
      title: 'Movies',
      eyebrow: 'Editorial Queue',
      badge: 'Movie Ops',
      description: 'Curate movie inventory, quality-check metadata, and publish faster.',
    };
  }

  if (pathname.startsWith('/admin/series')) {
    return {
      title: 'Series',
      eyebrow: 'Editorial Queue',
      badge: 'Series Ops',
      description: 'Keep episodic content clean, searchable, and release-ready.',
    };
  }

  return {
    title: 'Dashboard',
    eyebrow: 'Admin Workspace',
    badge: 'Control Room',
    description: 'Operate the portal from a cleaner, faster editorial workspace.',
  };
}

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState(() => (localStorage.getItem('token') ? 'checking' : 'unauthenticated'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const { isMobile } = useBreakpoint();
  const [user] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  });

  const sectionMeta = useMemo(() => getSectionMeta(location.pathname), [location.pathname]);
  const filteredNavItems = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    if (!query) {
      return adminNavItems;
    }
    return adminNavItems.filter((item) => (
      item.label.toLowerCase().includes(query)
      || item.hint.toLowerCase().includes(query)
      || item.path.toLowerCase().includes(query)
    ));
  }, [quickSearch]);

  useEffect(() => {
    if (authState !== 'checking') {
      return;
    }

    authService.verify()
      .then(() => setAuthState('authenticated'))
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState('unauthenticated');
      });
  }, [authState]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const search = document.getElementById('admin-quick-search');
        search?.focus();
        search?.select?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = () => {
    authService.logout().catch(() => null).finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    });
  };

  if (authState === 'checking') {
    return <div style={styles.loadingShell}>Checking admin session...</div>;
  }

  if (authState !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={styles.shell}>
      {isMobile && sidebarOpen ? <button aria-label="Close admin navigation overlay" style={styles.overlay} onClick={() => setSidebarOpen(false)} /> : null}

      <div style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : {}) }}>
        <aside
          style={{
            ...styles.sidebar,
            ...(isMobile ? styles.sidebarMobile : {}),
            ...(isMobile && sidebarOpen ? styles.sidebarMobileOpen : {}),
          }}
        >
          <div style={styles.sidebarCard}>
            <div style={styles.logoRow}>
              <div style={styles.logo}>
                <span style={styles.logoIcon}>ISP</span>
                <div>
                  <span style={styles.logoText}>ISP Control</span>
                  <span style={styles.logoSub}>Editorial Suite</span>
                </div>
              </div>
              {isMobile ? (
                <button type="button" onClick={() => setSidebarOpen(false)} style={styles.iconBtn}>
                  Close
                </button>
              ) : null}
            </div>

            <div style={styles.profileCard}>
              <div>
                <span style={styles.profileLabel}>Signed in as</span>
                <strong style={styles.profileName}>{user?.username || 'Admin'}</strong>
              </div>
              <span style={styles.profileRole}>{user?.role || 'editor'}</span>
            </div>

            <div style={styles.workspaceCard}>
              <span style={styles.workspaceLabel}>Workspace Mode</span>
              <strong style={styles.workspaceTitle}>{sectionMeta.badge}</strong>
              <p style={styles.workspaceText}>{sectionMeta.description}</p>
            </div>

            <nav style={styles.nav}>
              {filteredNavItems.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      ...styles.navLink,
                      ...(active ? styles.navLinkActive : {}),
                    }}
                  >
                    <span style={{ ...styles.navIcon, ...(active ? styles.navIconActive : {}) }}>{item.icon}</span>
                    <span style={styles.navCopy}>
                      <span style={styles.navLabel}>{item.label}</span>
                      <span style={styles.navHint}>{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
              {!filteredNavItems.length ? (
                <div style={styles.emptyNav}>No section matched.</div>
              ) : null}
            </nav>

            <div style={styles.bottom}>
              <Link to="/" style={styles.backLink}>Back to Portal</Link>
              <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          <header style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
            <div style={styles.headerMain}>
              <div style={styles.headerTop}>
                {isMobile ? (
                  <button type="button" onClick={() => setSidebarOpen(true)} style={styles.menuBtn}>
                    Menu
                  </button>
                ) : null}
                <span style={styles.headerEyebrow}>{sectionMeta.eyebrow}</span>
              </div>
              <h1 style={styles.pageTitle}>{sectionMeta.title}</h1>
              <p style={styles.headerText}>{sectionMeta.description}</p>
            </div>

            <div style={styles.headerAside}>
              <div style={styles.headerBadge}>{sectionMeta.badge}</div>
              <label style={styles.quickSearchWrap}>
                <input
                  id="admin-quick-search"
                  type="text"
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && filteredNavItems.length) {
                      navigate(filteredNavItems[0].path);
                      if (isMobile) {
                        setSidebarOpen(false);
                      }
                    }
                  }}
                  placeholder="Quick jump... (Ctrl/Cmd+K)"
                  style={styles.quickSearchInput}
                />
              </label>
              <div style={styles.headerMiniGrid}>
                <Link to="/admin/content/new" style={styles.quickBtn}>Quick Add</Link>
                <Link to="/admin/content" style={styles.quickBtnSecondary}>Library</Link>
              </div>
            </div>
          </header>

          <div style={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    position: 'relative',
    minHeight: '100vh',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3, 8, 17, 0.72)',
    backdropFilter: 'blur(4px)',
    zIndex: 39,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(0, 1fr)',
    minHeight: '100vh',
    gap: '22px',
    padding: '22px',
  },
  layoutMobile: {
    gridTemplateColumns: '1fr',
    gap: '16px',
    padding: '16px',
  },
  sidebar: {
    position: 'relative',
    minWidth: 0,
  },
  sidebarMobile: {
    position: 'fixed',
    top: '16px',
    left: '16px',
    bottom: '16px',
    width: 'min(86vw, 340px)',
    zIndex: 40,
    transform: 'translateX(calc(-100% - 24px))',
    transition: 'transform var(--transition-normal)',
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  sidebarCard: {
    position: 'sticky',
    top: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minHeight: 'calc(100vh - 44px)',
    padding: '22px',
    borderRadius: '32px',
    background: 'linear-gradient(180deg, rgba(8,18,31,0.96), rgba(11,24,42,0.86))',
    border: '1px solid rgba(125,249,255,0.12)',
    boxShadow: '0 24px 60px rgba(4, 10, 20, 0.3)',
    backdropFilter: 'blur(18px)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    color: '#fff',
    fontSize: '0.78rem',
    letterSpacing: '0.18em',
    padding: '0.54rem 0.78rem',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #ff744f, #ffb347)',
    boxShadow: '0 12px 26px rgba(255,116,79,0.28)',
  },
  logoText: {
    display: 'block',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '1rem',
  },
  logoSub: {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    marginTop: '4px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  iconBtn: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
  },
  profileCard: {
    padding: '16px 18px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
  },
  profileLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontWeight: '700',
    display: 'block',
    marginBottom: '6px',
  },
  profileName: {
    color: 'var(--text-primary)',
  },
  profileRole: {
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(125,249,255,0.12)',
    color: 'var(--accent-cyan)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '700',
  },
  workspaceCard: {
    padding: '18px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, rgba(255,116,79,0.14), rgba(125,249,255,0.08))',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '8px',
  },
  workspaceLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontWeight: '700',
  },
  workspaceTitle: {
    color: 'var(--text-primary)',
    fontSize: '1.1rem',
  },
  workspaceText: {
    lineHeight: '1.7',
    fontSize: '0.9rem',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    color: 'var(--text-secondary)',
    borderRadius: '22px',
    fontSize: '0.92rem',
    fontWeight: '600',
    textDecoration: 'none',
    border: '1px solid transparent',
    background: 'rgba(255,255,255,0.02)',
  },
  navLinkActive: {
    background: 'linear-gradient(135deg, rgba(255,116,79,0.16), rgba(125,249,255,0.1))',
    color: 'var(--text-primary)',
    borderColor: 'rgba(125,249,255,0.18)',
  },
  navIcon: {
    fontSize: '0.72rem',
    minWidth: '2rem',
    textAlign: 'center',
    padding: '0.42rem 0.36rem',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.06)',
  },
  navIconActive: {
    background: 'rgba(125,249,255,0.14)',
    color: 'var(--accent-cyan)',
  },
  navCopy: {
    display: 'grid',
    gap: '4px',
  },
  navLabel: {
    color: 'inherit',
  },
  navHint: {
    color: 'var(--text-muted)',
    fontSize: '0.76rem',
  },
  emptyNav: {
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  bottom: {
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  backLink: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
  },
  logoutBtn: {
    color: '#ff9ea2',
    fontSize: '0.88rem',
    textAlign: 'left',
    fontWeight: '700',
  },
  main: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)',
    alignItems: 'end',
    gap: '16px',
    padding: '26px 28px',
    borderRadius: '32px',
    background: 'linear-gradient(135deg, rgba(10,22,39,0.92), rgba(19,38,62,0.72))',
    border: '1px solid rgba(125,249,255,0.1)',
    boxShadow: '0 18px 40px rgba(4, 10, 20, 0.24)',
  },
  headerMobile: {
    gridTemplateColumns: '1fr',
    padding: '20px',
  },
  headerMain: {
    display: 'grid',
    gap: '8px',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  menuBtn: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  headerEyebrow: {
    display: 'inline-block',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  pageTitle: {
    fontSize: '2.4rem',
    color: 'var(--text-primary)',
  },
  headerText: {
    maxWidth: '58ch',
    lineHeight: '1.8',
  },
  headerAside: {
    display: 'grid',
    gap: '12px',
    justifyItems: 'end',
  },
  quickSearchWrap: {
    width: '100%',
    maxWidth: '320px',
  },
  quickSearchInput: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontSize: '0.86rem',
  },
  headerBadge: {
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'rgba(255,200,87,0.14)',
    border: '1px solid rgba(255,200,87,0.28)',
    color: 'var(--accent-amber)',
    fontSize: '0.78rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  headerMiniGrid: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  quickBtn: {
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #ff744f, #ffb347)',
    color: '#fff',
    fontWeight: '700',
  },
  quickBtnSecondary: {
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  loadingShell: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-primary)',
    background: 'var(--bg-primary)',
  },
};

export default AdminLayout;
