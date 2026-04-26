import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function PageTransition({ children }) {
  const location = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = 'pageEnter 320ms cubic-bezier(0.22,1,0.36,1) both';
  }, [location.pathname]);

  return (
    <div ref={ref} style={styles.wrapper}>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    animation: 'pageEnter 320ms cubic-bezier(0.22,1,0.36,1) both',
  },
};

export default PageTransition;
