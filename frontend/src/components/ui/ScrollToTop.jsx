import { useEffect, useState } from 'react';

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollUp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <button
      onClick={scrollUp}
      style={styles.btn}
      aria-label="Scroll to top"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
      </svg>
    </button>
  );
}

const styles = {
  btn: {
    position: 'fixed',
    bottom: '24px',
    right: '20px',
    zIndex: 900,
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(13,26,43,0.92), rgba(7,17,31,0.92))',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    animation: 'fadeUp 220ms ease both',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  },
};

export default ScrollToTop;
