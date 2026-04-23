import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { watchlistService } from '../services';
import { useBreakpoint } from '../hooks';

const fallbackWatchlist = [
  { id: 1, title: 'The Night Hunter', poster: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400', year: 2024, genre: 'Action', type: 'movie' },
  { id: 2, title: 'City Lights', poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400', year: 2024, genre: 'Drama', type: 'movie' },
  { id: 3, title: 'Ocean Deep', poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400', year: 2023, genre: 'Adventure', type: 'series' },
  { id: 4, title: 'Mountain Echo', poster: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400', year: 2024, genre: 'Thriller', type: 'movie' },
  { id: 5, title: 'Silent Voices', poster: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400', year: 2023, genre: 'Romance', type: 'series' },
];

function WatchlistPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [items, setItems] = useState(fallbackWatchlist);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWatchlist() {
      try {
        setLoading(true);
        const data = await watchlistService.getAll();
        if (Array.isArray(data?.items)) {
          setItems(data.items);
        } else {
          setItems(fallbackWatchlist);
        }
      } catch {
        setItems(fallbackWatchlist);
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
              }}
            >
              {item === 'all' ? 'All' : item === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div style={styles.empty}>
          <h2>Loading your list...</h2>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>Your list is still open for favorites.</h2>
          <p>Save content from any details page and it will show up here with the same premium treatment.</p>
          <Link to="/" style={styles.browseBtn}>
            Browse Content
          </Link>
        </div>
      ) : (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
          {filteredItems.map((item, index) => {
            const detailsPath = `${item.type === 'series' ? '/series' : '/movies'}/${item.id}`;

            return (
              <div key={item.id} style={styles.card}>
                <Link to={detailsPath} style={styles.cardLink}>
                  <div style={styles.posterWrapper}>
                    <img src={item.poster} alt={item.title} style={styles.poster} loading="lazy" />
                    <div style={styles.overlay} />
                    <span style={styles.rankBadge}>{String(index + 1).padStart(2, '0')}</span>
                    <span style={styles.typeBadge}>{item.type === 'series' ? 'Series' : 'Movie'}</span>
                  </div>
                  <div style={styles.info}>
                    <h3 style={styles.cardTitle}>{item.title}</h3>
                    <span style={styles.cardMeta}>{item.genre} • {item.year}</span>
                  </div>
                </Link>
                <div style={{ ...styles.cardActions, ...(isMobile ? styles.cardActionsMobile : {}) }}>
                  <Link to={`/watch/${item.id}`} style={styles.quickPlayBtn}>
                    Play
                  </Link>
                  <button onClick={() => removeItem(item.id)} style={styles.removeBtn}>
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
    position: 'sticky',
    top: '78px',
    zIndex: 20,
    backdropFilter: 'blur(18px)',
  },
  kicker: {
    color: 'var(--accent-amber)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  title: {
    fontSize: 'clamp(2.4rem, 5vw, 4.4rem)',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '22px',
  },
  gridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  card: {
    display: 'grid',
    gap: '12px',
  },
  cardLink: {
    textDecoration: 'none',
  },
  posterWrapper: {
    position: 'relative',
    borderRadius: '26px',
    overflow: 'hidden',
    aspectRatio: '3/4',
    background: 'var(--bg-tertiary)',
    boxShadow: 'var(--shadow-card)',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 10%, rgba(7,17,31,0.82) 100%)',
  },
  rankBadge: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'rgba(7,17,31,0.78)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '0.76rem',
  },
  typeBadge: {
    position: 'absolute',
    right: '14px',
    bottom: '14px',
    background: 'rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    borderRadius: '999px',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: '700',
  },
  info: {
    padding: '4px 4px 0',
  },
  cardTitle: {
    fontSize: '1.15rem',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  cardMeta: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
  },
  cardActionsMobile: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  quickPlayBtn: {
    flex: 1,
    textAlign: 'center',
    padding: '12px 14px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    fontWeight: '700',
  },
  removeBtn: {
    padding: '12px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
  },
  empty: {
    maxWidth: '1400px',
    margin: '0 auto',
    textAlign: 'center',
    padding: 'var(--spacing-2xl)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    maxWidth: '860px',
    margin: '0 auto',
    textAlign: 'center',
    padding: 'var(--spacing-3xl) 24px',
    borderRadius: '32px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  emptyTitle: {
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  browseBtn: {
    display: 'inline-block',
    marginTop: 'var(--spacing-lg)',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    borderRadius: '999px',
    fontWeight: '700',
  },
};

export default WatchlistPage;
