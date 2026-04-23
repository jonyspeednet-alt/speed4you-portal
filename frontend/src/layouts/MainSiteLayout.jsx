import { Outlet } from 'react-router-dom';
import TopNav from '../components/navigation/TopNav';
import { useBreakpoint } from '../hooks';

function MainSiteLayout() {
  const { isMobile, isTablet } = useBreakpoint();

  return (
    <div style={styles.wrapper}>
      <a href="#main-content" style={styles.skipLink}>Skip to content</a>
      <TopNav />
      <main
        id="main-content"
        style={{
          ...styles.main,
          paddingTop: isMobile ? '84px' : isTablet ? '90px' : '96px',
        }}
      >
        <Outlet />
      </main>
    </div>
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
  },
  main: {
    flex: 1,
  },
};

export default MainSiteLayout;
