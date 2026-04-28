import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import WatchlistButton from './WatchlistButton';

export default function QuickViewModal({ isOpen, onClose, item }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const isSeries = item.type === 'series';
  const linkPath = isSeries ? `/series/${item.id}` : `/movies/${item.id}`;
  const playPath = `/watch/${item.id}`;

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div 
        style={styles.modal} 
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close preview">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div style={styles.header}>
          <img src={item.backdrop || item.poster} alt={item.title} style={styles.backdrop} />
          <div style={styles.headerGradient} />
          <div style={styles.titleContent}>
            <h2 style={styles.title}>{item.title}</h2>
            <div style={styles.metaRow}>
              <span style={styles.rating}>★ {item.rating || 'N/A'}</span>
              <span style={styles.year}>{item.year || 'Unknown'}</span>
              <span style={styles.badge}>{isSeries ? 'Series' : 'Movie'}</span>
            </div>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.actions}>
            <Link to={playPath} style={styles.playBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Now
            </Link>
            <Link to={linkPath} style={styles.infoBtn}>
              More Info
            </Link>
            <WatchlistButton 
              contentType={isSeries ? 'series' : 'movie'} 
              contentId={item.id} 
              title={item.title} 
              compact={false}
            />
          </div>

          <p style={styles.overview}>
            {item.description || 'Get ready for an incredible streaming experience. This title is highly recommended by our curators.'}
          </p>

          <div style={styles.detailsGrid}>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Genre:</span>
              <span style={styles.detailValue}>{item.genre || 'Uncategorized'}</span>
            </div>
            <div style={styles.detailItem}>
              <span style={styles.detailLabel}>Language:</span>
              <span style={styles.detailValue}>{item.language || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(5, 12, 22, 0.5)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    animation: 'fadeIn 300ms ease-out',
  },
  modal: {
    position: 'relative',
    width: '100%',
    maxWidth: '900px',
    backgroundColor: '#050c16',
    borderRadius: '32px',
    overflow: 'hidden',
    boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
    animation: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
  closeBtn: {
    position: 'absolute',
    top: '24px',
    right: '24px',
    zIndex: 10,
    background: 'rgba(5, 12, 22, 0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    transition: 'all 0.2s',
  },
  header: {
    position: 'relative',
    height: '420px',
    width: '100%',
  },
  backdrop: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 20%',
  },
  headerGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(5,12,22,0.2) 0%, rgba(5,12,22,0.4) 50%, #050c16 100%), linear-gradient(105deg, rgba(5,12,22,0.8) 0%, transparent 60%)',
  },
  titleContent: {
    position: 'absolute',
    bottom: '24px',
    left: '40px',
    right: '40px',
  },
  title: {
    fontSize: 'clamp(2.4rem, 6vw, 3.6rem)',
    fontWeight: '900',
    color: '#fff',
    marginBottom: '16px',
    lineHeight: '0.95',
    letterSpacing: '-0.03em',
    textShadow: '0 10px 30px rgba(0,0,0,0.6)',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  rating: {
    color: 'var(--accent-cyan)',
    fontWeight: '900',
    fontSize: '1.2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  year: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  badge: {
    background: 'rgba(255,255,255,0.1)',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  body: {
    padding: '0 40px 40px',
  },
  actions: {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  playBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-secondary))',
    color: '#050c16',
    padding: '14px 32px',
    borderRadius: '14px',
    fontWeight: '900',
    fontSize: '1.1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
    transition: 'transform 0.2s',
  },
  infoBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    padding: '14px 28px',
    borderRadius: '14px',
    fontWeight: '700',
    fontSize: '1.1rem',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(12px)',
    transition: 'background 0.2s',
  },
  overview: {
    fontSize: '1.15rem',
    lineHeight: '1.7',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '32px',
    maxWidth: '60ch',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '24px',
    padding: '24px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.75rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  detailValue: {
    color: '#fff',
    fontWeight: '700',
    fontSize: '1rem',
  },
};
