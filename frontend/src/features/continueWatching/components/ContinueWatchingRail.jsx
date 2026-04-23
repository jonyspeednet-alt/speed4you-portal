import { Link } from 'react-router-dom';

function ContinueWatchingRail({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={styles.section}>
      <h2 style={styles.title}>Continue Watching</h2>
      <div style={styles.rail}>
        {items.map((item) => (
          <Link key={item.id} to={`/watch/${item.id}`} style={styles.card}>
            <div style={styles.posterWrapper}>
              <img src={item.poster} alt={item.title} style={styles.poster} loading="lazy" />
              <div style={styles.progressContainer}>
                <div style={{...styles.progressBar, width: `${item.progress}%`}} />
              </div>
              <div style={styles.overlay}>
                <div style={styles.playIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div style={styles.info}>
              <h3 style={styles.cardTitle}>{item.title}</h3>
              <span style={styles.progressText}>{item.progress}% watched</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles = {
  section: {
    padding: 'var(--spacing-lg) 0',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-md)',
    padding: '0 var(--spacing-lg)',
  },
  rail: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    padding: '0 var(--spacing-lg)',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
  },
  card: {
    flex: '0 0 auto',
    width: '200px',
    scrollSnapAlign: 'start',
    textDecoration: 'none',
  },
  posterWrapper: {
    position: 'relative',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    aspectRatio: '16/9',
    background: 'var(--bg-tertiary)',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent-red)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity var(--transition-fast)',
  },
  playIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--accent-red)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 'var(--spacing-sm) 0',
  },
  cardTitle: {
    fontSize: '0.9rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
};

export default ContinueWatchingRail;