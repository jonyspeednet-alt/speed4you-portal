import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TopNav from '../components/navigation/TopNav';
import ScrollToTop from '../components/ui/ScrollToTop';
import BottomNav from '../components/ui/BottomNav';
import KeyboardShortcuts from '../components/ui/KeyboardShortcuts';
import { ToastProvider } from '../components/ui/Toast';
import { useBreakpoint, useTVMode } from '../hooks';

import GlobalSearchModal from '../components/navigation/GlobalSearchModal';
import PwaInstallBanner from '../components/ui/PwaInstallBanner';

function MainSiteLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const isTVMode = useTVMode();
  const isPlayerRoute = location.pathname.startsWith('/watch/') || location.pathname.startsWith('/play/');
  const isHomeRoute = location.pathname === '/';

  useEffect(() => {
    if (!isTVMode) return;

    const handleGlobalBack = (e) => {
      if (e.key === 'Backspace' || e.key === 'Escape') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
          return;
        }

        if (location.pathname !== '/') {
          e.preventDefault();
          navigate(-1);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalBack);
    return () => window.removeEventListener('keydown', handleGlobalBack);
  }, [isTVMode, location.pathname, navigate]);

  return (
    <ToastProvider>
      <div style={styles.wrapper}>
        <a
          href="#main-content"
          style={styles.skipLink}
          className="skip-link"
          onFocus={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          onBlur={(e) => { e.currentTarget.style.transform = 'translateY(-140%)'; }}
        >
          Skip to content
        </a>
        {!isPlayerRoute && <TopNav />}
        <main
          id="main-content"
          style={{
            ...styles.main,
            ...(isPlayerRoute ? styles.mainImmersive : {
              paddingTop: isHomeRoute ? 0 : isMobile ? '84px' : isTablet ? '92px' : '96px',
              paddingBottom: isMobile ? '112px' : 0,
            }),
          }}
        >
          <Outlet />
        </main>
        <ScrollToTop />
        {isMobile && !isPlayerRoute && <BottomNav />}
        {!isMobile && !isPlayerRoute && <KeyboardShortcuts />}
        <GlobalSearchModal />
        <PwaInstallBanner />
      </div>
    </ToastProvider>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  skipLink: {
    position: 'fixed',
    top: '12px',
    left: '12px',
    zIndex: 1400,
    padding: '10px 14px',
    borderRadius: '999px',
    background: '#fff',
    color: '#07111f',
    fontWeight: '700',
    transform: 'translateY(-140%)',
    transition: 'transform 200ms ease',
    outline: 'none',
  },
  main: {
    flex: 1,
  },
  mainImmersive: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
};

export default MainSiteLayout;
