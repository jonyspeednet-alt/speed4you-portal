import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks';

function ContentRail({ title, items, type = 'default', subtitle = 'Curated now', viewAllLink, priorityCount = 0 }) {
  const scrollRef = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();

  const scroll = (direction) => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  };

  const accent = title === 'Popular on ISP Portal'
    ? 'var(--accent-red)'
    : title === 'Bengali Picks'
      ? 'var(--accent-amber)'
      : 'var(--accent-cyan)';

  return (
    <section style={styles.section}>
      <div style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
        <div style={styles.headingCopy}>
          <span style={{ ...styles.eyebrow, color: accent }}>{subtitle}</span>
          <h2 style={styles.title}>{title}</h2>
        </div>

        <div style={styles.headerActions}>
          {viewAllLink && <Link to={viewAllLink} style={styles.viewAll}>View All</Link>}
          {!isMobile && <div style={styles.controls}>
            <button onClick={() => scroll('left')} style={styles.arrowBtn} aria-label={`Scroll ${title} left`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
            <button onClick={() => scroll('right')} style={styles.arrowBtn} aria-label={`Scroll ${title} right`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
            </button>
          </div>}
        </div>
      </div>

      <div style={{ ...styles.rail, ...(isMobile ? styles.railMobile : {}) }} ref={scrollRef}>
        {items.map((item, index) => (
          <ContentCard key={item.id} item={item} type={type} index={index} eager={index < priorityCount} compact={isMobile} tablet={isTablet} />
        ))}
      </div>
    </section>
  );
}

function ContentCard({ item, type, index, eager, compact, tablet }) {
  const isSeries = type === 'series' || item.type === 'series';
  const linkPath = isSeries ? `/series/${item.id}` : `/movies/${item.id}`;
  const rankLabel = String(index + 1).padStart(2, '0');
  const hasPoster = Boolean(item.poster);

  return (
    <Link
      to={linkPath}
      style={{
        ...styles.card,
        ...(compact ? styles.cardMobile : tablet ? styles.cardTablet : {}),
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={styles.posterWrapper}>
        {hasPoster ? (
          <img
            src={item.poster}
            alt={item.title}
            style={styles.poster}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'low'}
            decoding="async"
          />
        ) : (
          <div style={styles.posterFallback}>
            <span style={styles.posterFallbackType}>{isSeries ? 'Series' : 'Movie'}</span>
            <strong style={styles.posterFallbackTitle}>{item.title}</strong>
            <span style={styles.posterFallbackMeta}>{item.year || 'Streaming now'}</span>
          </div>
        )}

        <div style={styles.glow} />
        <div style={styles.rankBadge}>{rankLabel}</div>

        {type === 'continue' && item.progress && (
          <div style={styles.progressContainer}>
            <div style={{ ...styles.progressBar, width: `${item.progress}%` }} />
          </div>
        )}

        <div style={styles.cardTopMeta}>
          {item.rating && (
            <div style={styles.rating}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffc857" aria-hidden="true">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              <span>{item.rating}</span>
            </div>
          )}
          <span style={styles.typeBadge}>{isSeries ? 'Series' : 'Movie'}</span>
        </div>

        <div style={styles.overlay}>
          <div style={styles.playIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div style={styles.cardInfo}>
        <h3 style={styles.cardTitle}>{item.title}</h3>
        <div style={styles.cardMeta}>
          <span>{item.genre || 'Featured'}</span>
          <span>{item.year || 'Now'}</span>
        </div>
        {type === 'continue' && item.progress && (
          <div style={styles.cardMeta}>
            <span>{item.progress}% watched</span>
            <span>Resume now</span>
          </div>
        )}
      </div>
    </Link>
  );
}

const styles = {
  section: {
    padding: 'var(--spacing-xl) 0',
    contentVisibility: 'auto',
    containIntrinsicSize: '900px',
  },
  header: {
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: 'var(--spacing-md)',
    padding: '0 var(--spacing-lg)',
    maxWidth: '1400px',
    margin: '0 auto 18px auto',
  },
  headerMobile: {
    alignItems: 'start',
  },
  headingCopy: {
    display: 'grid',
    gap: '4px',
  },
  eyebrow: {
    display: 'inline-block',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '2rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  viewAll: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.82rem',
  },
  controls: {
    display: 'flex',
    gap: '10px',
  },
  arrowBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
  },
  rail: {
    display: 'flex',
    gap: '20px',
    padding: '0 var(--spacing-lg)',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  railMobile: {
    gap: '14px',
    padding: '0 var(--spacing-md)',
  },
  card: {
    flex: '0 0 auto',
    width: '240px',
    scrollSnapAlign: 'start',
    display: 'grid',
    gap: '12px',
    animation: 'fadeUp 520ms ease both',
  },
  cardTablet: {
    width: '220px',
  },
  cardMobile: {
    width: '160px',
    gap: '10px',
  },
  posterWrapper: {
    position: 'relative',
    borderRadius: '26px',
    overflow: 'hidden',
    aspectRatio: '3 / 4',
    background: 'var(--bg-tertiary)',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform var(--transition-slow)',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '18px',
    background: 'linear-gradient(160deg, rgba(23, 47, 79, 0.96), rgba(7, 17, 31, 0.98) 60%, rgba(163, 52, 42, 0.92))',
    color: 'var(--text-primary)',
  },
  posterFallbackType: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '0.35rem 0.7rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.68rem',
    fontWeight: '700',
  },
  posterFallbackTitle: {
    fontSize: '1.3rem',
    lineHeight: '1.15',
    textWrap: 'balance',
  },
  posterFallbackMeta: {
    fontSize: '0.82rem',
    color: 'var(--text-secondary)',
  },
  glow: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(7,17,31,0.04) 28%, rgba(7,17,31,0.88) 100%)',
  },
  rankBadge: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(7, 17, 31, 0.72)',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '700',
    backdropFilter: 'blur(10px)',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '5px',
    background: 'rgba(255,255,255,0.18)',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-red), var(--accent-amber))',
  },
  cardTopMeta: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    display: 'grid',
    gap: '8px',
    justifyItems: 'end',
  },
  rating: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(7,17,31,0.72)',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.76rem',
    color: 'var(--text-primary)',
    backdropFilter: 'blur(10px)',
  },
  typeBadge: {
    background: 'rgba(255,255,255,0.14)',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.68rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-primary)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 18px 30px rgba(0,0,0,0.28)',
  },
  cardInfo: {
    display: 'grid',
    gap: '8px',
  },
  cardTitle: {
    fontSize: '1.2rem',
    color: 'var(--text-primary)',
    lineHeight: '1.18',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
};

export default ContentRail;
