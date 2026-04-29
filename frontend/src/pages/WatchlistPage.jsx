import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { watchlistService } from '../services';
import { useBreakpoint } from '../hooks';
import { CardSkeleton } from '../components/feedback/Skeleton';
import WatchlistButton from '../components/ui/WatchlistButton';

function WatchlistPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hoveredFilter, setHoveredFilter] = useState(null);

  useEffect(() => {
    async function fetchWatchlist() {
      try {
        setLoading(true);
        const data = await watchlistService.getAll();
        if (Array.isArray(data?.items)) {
          setItems(data.items);
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchWatchlist();
  }, []);

  const removeItem = async (id) => {
    try {
      await watchlistService.remove(id);
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } catch {
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    }
  };

  const filteredItems = filter === 'all'
    ? items
    : items.filter((item) => (item.type || 'movie') === filter);

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
        <div>
          <span style={styles.kicker}>Saved Collection</span>
          <h1 style={styles.title}>My List</h1>
          <p style={styles.description}>Keep premium picks within reach and jump back into your favorite titles any time.</p>
        </div>

        <div style={{ ...styles.filters, ...(isMobile ? styles.filtersMobile : {}) }}>
          {['all', 'movie', 'series'].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              style={{
                ...styles.filterBtn,
                ...(filter === item ? styles.filterBtnActive : {}),
                ...(hoveredFilter === item && filter !== item ? styles.filterBtnHover : {}),
              }}
              onMouseEnter={() => setHoveredFilter(item)}
              onMouseLeave={() => setHoveredFilter(null)}
            >
              {item === 'all' ? 'All' : item === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </div>
          <h2 style={styles.emptyTitle}>
            {filter === 'all' ? 'Your list is empty' : `No ${filter === 'movie' ? 'movies' : 'series'} saved yet`}
          </h2>
          <p style={styles.emptyText}>
            {filter === 'all'
              ? 'Browse movies and series, then tap the + button on any title to save it here.'
              : `Switch to "All" or browse to find ${filter === 'movie' ? 'movies' : 'series'} to save.`}
          </p>
          <div style={styles.emptyActions}>
            <Link to="/movies" style={styles.browseBtn}>Browse Movies</Link>
            <Link to="/series" style={styles.browseBtnSecondary}>Browse Series</Link>
          </div>
        </div>
      ) : (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
          {filteredItems.map((item, index) => {
            const detailsPath = `${item.type === 'series' ? '/series' : '/movies'}/${item.id}`;

            return (
              <div key={item.id} style={styles.card}>
                <Link to={detailsPath} style={styles.cardLink}>
                  <div style={styles.posterWrapper}>
                    <img
                      src={item.poster || '/portal/assets/poster-placeholder.svg'}
                      alt={item.title}
                      style={styles.poster}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = '/portal/assets/poster-placeholder.svg'; }}
                    />
                    <div style={styles.overlay} />
                    <span style={styles.rankBadge}>{String(index + 1).padStart(2, '0')}</span>
                    <span style={styles.typeBadge}>{item.type === 'series' ? 'Series' : 'Movie'}</span>
                    {item.progress > 0 && (
                      <div style={styles.progressBar}>
                        <div style={{ ...styles.progressFill, width: `${Math.min(item.progress, 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <div style={styles.info}>
                    <h3 style={{ ...styles.cardTitle, ...(isMobile ? styles.cardTitleMobile : {}) }}>{item.title}</h3>
                    <span style={styles.cardMeta}>{item.genre} • {item.year}</span>
                    {item.progress > 0 && (
                      <span style={styles.progressLabel}>{item.progress}% watched</span>
                    )}
                  </div>
                </Link>
                <div style={{ ...styles.cardActions, ...(isMobile ? styles.cardActionsMobile : {}) }}>
                  <Link to={`/watch/${item.id}`} style={styles.quickPlayBtn}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play</span>
                  </Link>
                  <button onClick={() => removeItem(item.id)} style={styles.removeBtn} aria-label={`Remove ${item.title} from list`}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '112px var(--spacing-lg) var(--spacing-3xl)',
  },
  pageMobile: {
    padding: '96px var(--spacing-md) var(--spacing-2xl)',
  },
  hero: {
    maxWidth: '1400px',
    margin: '0 auto 28px auto',
    padding: '28px',
    borderRadius: '32px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 'var(--spacing-xl)',
    alignItems: 'end',
  },
  heroTablet: {
    gridTemplateColumns: '1fr',
  },
  heroMobile: {
    padding: '18px',
    gridTemplateColumns: '1fr',
    gap: '18px',
  },
  kicker: {
    color: 'var(--accent-amber)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  title: {
    fontSize: 'clamp(2rem, 5vw, 4.4rem)',
    color: 'var(--text-primary)',
    margin: '10px 0',
  },
  description: {
    maxWidth: '56ch',
    lineHeight: '1.8',
  },
  filters: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  filtersMobile: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: '6px',
    scrollbarWidth: 'none',
  },
  filterBtn: {
    padding: '12px 18px',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-secondary)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '999px',
    fontSize: '0.86rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
  },
  filterBtnHover: {
    background: 'rgba(255,255,255,0.09)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  filterBtnActive: {
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    boxShadow: '0 12px 30px rgba(255,90,95,0.24)',
  },
  grid: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
  gridTablet: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
  },
  gridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  card: {
    display: 'grid',
    gap: '8px',
  },
  cardLink: {
    textDecoration: 'none',
  },
  posterWrapper: {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    aspectRatio: '2/3',
    background: 'linear-gradient(160deg, #0d1c30, #070d18)',
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
    transition: 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 360ms ease',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.08) 45%, rgba(7,17,31,0.88) 100%)',
    pointerEvents: 'none',
  },
  rankBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    padding: '5px 10px',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  typeBadge: {
    position: 'absolute',
    right: '10px',
    top: '10px',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.9)',
    padding: '5px 10px',
    borderRadius: '8px',
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: '800',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  info: {
    padding: '0 2px',
  },
  cardTitle: {
    fontSize: '0.88rem',
    color: 'var(--text-primary)',
    fontWeight: '700',
    lineHeight: '1.3',
    marginBottom: '4px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardTitleMobile: {
    fontSize: '0.82rem',
  },
  cardMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
  },
  cardActionsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  quickPlayBtn: {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    textAlign: 'center',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--accent-primary-strong), var(--accent-primary))',
    color: '#fff',
    fontWeight: '700',
    fontSize: '0.82rem',
  },
  removeBtn: {
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: 'var(--text-muted)',
    fontWeight: '700',
    fontSize: '0.82rem',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'rgba(255,255,255,0.12)',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-tertiary))',
    borderRadius: '0 2px 2px 0',
  },
  progressLabel: {
    fontSize: '0.76rem',
    color: 'var(--accent-amber)',
    fontWeight: '700',
  },
  emptyState: {
    maxWidth: '480px',
    margin: '0 auto',
    textAlign: 'center',
    padding: '56px 24px',
    borderRadius: '32px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    margin: '0 auto 20px',
    color: 'var(--text-muted)',
  },
  emptyTitle: {
    color: 'var(--text-primary)',
    marginBottom: '12px',
    fontSize: '1.4rem',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
    marginBottom: '24px',
    maxWidth: '36ch',
    margin: '0 auto 24px',
  },
  emptyActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  browseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '13px 22px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    borderRadius: '999px',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
  browseBtnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '13px 22px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    borderRadius: '999px',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
};

export default WatchlistPage;
