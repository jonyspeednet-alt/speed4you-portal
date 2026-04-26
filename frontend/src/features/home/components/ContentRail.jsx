import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks';
import WatchlistButton from '../../../components/ui/WatchlistButton';

function ContentRail({ title, items, type = 'default', subtitle = 'Curated now', viewAllLink, priorityCount = 0 }) {
  const scrollRef = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();
  const [leftHovered, setLeftHovered] = useState(false);
  const [rightHovered, setRightHovered] = useState(false);
  const [viewAllHovered, setViewAllHovered] = useState(false);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
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
          <h2 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>{title}</h2>
        </div>
        <div style={styles.headerActions}>
          {viewAllLink && (
            <Link
              to={viewAllLink}
              style={{ ...styles.viewAll, ...(viewAllHovered ? styles.viewAllHover : {}) }}
              onMouseEnter={() => setViewAllHovered(true)}
              onMouseLeave={() => setViewAllHovered(false)}
            >
              View All
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          {!isMobile && (
            <div style={styles.controls}>
              <button
                onClick={() => scroll('left')}
                onMouseEnter={() => setLeftHovered(true)}
                onMouseLeave={() => setLeftHovered(false)}
                style={{ ...styles.arrowBtn, ...(leftHovered ? styles.arrowBtnHover : {}) }}
                aria-label={`Scroll ${title} left`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                onMouseEnter={() => setRightHovered(true)}
                onMouseLeave={() => setRightHovered(false)}
                style={{ ...styles.arrowBtn, ...(rightHovered ? styles.arrowBtnHover : {}) }}
                aria-label={`Scroll ${title} right`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.rail, ...(isMobile ? styles.railMobile : {}) }} ref={scrollRef}>
        {items.map((item, index) => (
          <ContentCard
            key={item.id}
            item={item}
            type={type}
            index={index}
            eager={index < priorityCount}
            compact={isMobile}
            tablet={isTablet}
          />
        ))}
      </div>
    </section>
  );
}

function ContentCard({ item, type, index, eager, compact = false, tablet = false }) {
  const isSeries = type === 'series' || item.type === 'series';
  const linkPath = isSeries ? `/series/${item.id}` : `/movies/${item.id}`;
  const rankLabel = String(index + 1).padStart(2, '0');
  const hasPoster = Boolean(item.poster);
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const isNew = item.year && Number(item.year) >= new Date().getFullYear();
  const quality = item.quality || (item.resolution === '4K' ? '4K' : item.resolution === '1080p' ? 'HD' : null);

  return (
    <div
      style={{
        ...styles.cardWrap,
        ...(compact ? styles.cardWrapMobile : tablet ? styles.cardWrapTablet : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={linkPath}
        style={{ ...styles.card, animationDelay: `${index * 60}ms` }}
      >
        <div
          style={{
            ...styles.posterWrapper,
            transform: hovered && !compact ? 'scale(1.03)' : 'scale(1)',
            boxShadow: hovered && !compact
              ? '0 24px 48px rgba(0,0,0,0.5), 0 0 28px rgba(255,90,95,0.2)'
              : 'var(--shadow-card)',
          }}
        >
          {!imgLoaded && (
            <div style={styles.posterPlaceholder} aria-hidden="true">
              <div style={styles.placeholderShimmer} />
              <span style={styles.placeholderLabel}>{isSeries ? 'Series' : 'Movie'}</span>
            </div>
          )}

          {hasPoster ? (
            <img
              src={item.poster}
              alt={item.title}
              style={{ ...styles.poster, opacity: imgLoaded ? 1 : 0 }}
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={eager ? 'high' : 'low'}
              decoding="async"
              onLoad={() => setImgLoaded(true)}
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

          <div style={styles.topBadges}>
            {isNew && <span style={styles.newBadge}>NEW</span>}
            {quality && <span style={styles.qualityBadge}>{quality}</span>}
          </div>

          {type === 'continue' && item.progress && (
            <div style={styles.progressContainer}>
              <div style={{ ...styles.progressBar, width: `${item.progress}%` }} />
            </div>
          )}

          <div style={styles.cardTopMeta}>
            {item.rating && (
              <div style={styles.rating}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffc857" aria-hidden="true">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                <span>{item.rating}</span>
              </div>
            )}
            <span style={styles.typeBadge}>{isSeries ? 'Series' : 'Movie'}</span>
          </div>

          <div style={{
            ...styles.hoverOverlay,
            opacity: hovered && !compact ? 1 : 0,
            pointerEvents: hovered && !compact ? 'auto' : 'none',
          }}>
            <div style={{
              ...styles.playIcon,
              transform: hovered && !compact ? 'scale(1)' : 'scale(0.8)',
              transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {compact && (
            <div style={styles.mobileWatchlistBtn} onClick={(e) => e.preventDefault()}>
              <WatchlistButton
                contentType={isSeries ? 'series' : 'movie'}
                contentId={item.id}
                title={item.title}
                compact
              />
            </div>
          )}
        </div>

        <div style={styles.cardInfo}>
          <h3
            style={{ ...styles.cardTitle, ...(compact ? styles.cardTitleMobile : {}) }}
            title={item.title}
          >
            {item.title}
          </h3>
          <div style={styles.cardMeta}>
            <span style={styles.cardMetaItem}>{item.genre || 'Featured'}</span>
            <span style={styles.cardMetaDot} aria-hidden="true">·</span>
            <span style={styles.cardMetaItem}>{item.year || 'Now'}</span>
          </div>
          {type === 'continue' && item.progress && (
            <div style={styles.cardMeta}>
              <span>{item.progress}% watched</span>
              <span style={{ color: 'var(--accent-cyan)' }}>Resume</span>
            </div>
          )}
        </div>
      </Link>

      {!compact && (
        <div style={{
          ...styles.desktopWatchlistBtn,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.9)',
        }}>
          <WatchlistButton
            contentType={isSeries ? 'series' : 'movie'}
            contentId={item.id}
            title={item.title}
            compact
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  section: {
    padding: 'var(--spacing-xl) 0',
  },
  header: {
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: 'var(--spacing-md)',
    padding: '0 var(--spacing-lg)',
    maxWidth: '1400px',
    margin: '0 auto 20px auto',
  },
  headerMobile: { alignItems: 'start' },
  headingCopy: { display: 'grid', gap: '5px' },
  eyebrow: {
    display: 'inline-block',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    fontSize: '0.7rem',
    fontWeight: '800',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '1.9rem',
    letterSpacing: '-0.025em',
  },
  titleMobile: { fontSize: '1.35rem' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  viewAll: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
    fontSize: '0.8rem',
    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
  },
  viewAllHover: {
    background: 'rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  controls: { display: 'flex', gap: '8px' },
  arrowBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
    transition: 'background 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
    cursor: 'pointer',
  },
  arrowBtnHover: {
    background: 'rgba(255,255,255,0.14)',
    color: 'var(--text-primary)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    transform: 'scale(1.08)',
  },
  rail: {
    display: 'flex',
    gap: '20px',
    padding: '4px var(--spacing-lg) 12px',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  railMobile: { gap: '14px', padding: '4px var(--spacing-md) 12px' },
  cardWrap: {
    flex: '0 0 auto',
    width: '220px',
    scrollSnapAlign: 'start',
    position: 'relative',
  },
  cardWrapTablet: { width: '190px' },
  cardWrapMobile: { width: '155px' },
  card: {
    display: 'grid',
    gap: '10px',
    animation: 'fadeUp 520ms ease both',
    textDecoration: 'none',
    width: '100%',
    minWidth: 0,
  },
  posterWrapper: {
    position: 'relative',
    width: '100%',
    borderRadius: '20px',
    overflow: 'hidden',
    aspectRatio: '3 / 4',
    background: 'var(--bg-tertiary)',
    border: '1px solid rgba(255,255,255,0.07)',
    transition: 'transform 300ms ease, box-shadow 300ms ease',
  },
  posterPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'flex-end',
    padding: '14px',
    background: 'linear-gradient(160deg, #0d1e33, #0a1322)',
  },
  placeholderShimmer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.8s ease-in-out infinite',
  },
  placeholderLabel: {
    position: 'relative',
    color: 'rgba(255,255,255,0.18)',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: '700',
  },
  poster: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 300ms ease',
  },
  posterFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '18px',
    background: 'linear-gradient(160deg, rgba(23,47,79,0.96), rgba(7,17,31,0.98) 60%, rgba(163,52,42,0.92))',
    color: 'var(--text-primary)',
  },
  posterFallbackType: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '0.3rem 0.65rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.65rem',
    fontWeight: '700',
  },
  posterFallbackTitle: { fontSize: '1.2rem', lineHeight: '1.15', textWrap: 'balance' },
  posterFallbackMeta: { fontSize: '0.8rem', color: 'var(--text-secondary)' },
  glow: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(7,17,31,0.02) 28%, rgba(7,17,31,0.85) 100%)',
    pointerEvents: 'none',
  },
  rankBadge: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(7,17,31,0.75)',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    fontSize: '0.72rem',
    fontWeight: '800',
    backdropFilter: 'blur(10px)',
  },
  topBadges: {
    position: 'absolute',
    top: '12px',
    left: '50px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  newBadge: {
    padding: '3px 7px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  qualityBadge: {
    padding: '3px 7px',
    borderRadius: '6px',
    background: 'rgba(125,249,255,0.16)',
    border: '1px solid rgba(125,249,255,0.28)',
    color: 'var(--accent-cyan)',
    fontSize: '0.58rem',
    fontWeight: '800',
    letterSpacing: '0.08em',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'rgba(255,255,255,0.15)',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--accent-red), var(--accent-amber))',
    boxShadow: '0 0 6px rgba(255,90,95,0.5)',
  },
  cardTopMeta: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'grid',
    gap: '5px',
    justifyItems: 'end',
  },
  rating: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(7,17,31,0.78)',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,200,87,0.2)',
  },
  typeBadge: {
    background: 'rgba(255,255,255,0.12)',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '0.62rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--text-primary)',
    backdropFilter: 'blur(8px)',
  },
  hoverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7,17,31,0.42)',
    transition: 'opacity 200ms ease',
  },
  playIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: '1.5px solid rgba(255,255,255,0.3)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  },
  mobileWatchlistBtn: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
  },
  desktopWatchlistBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    transition: 'opacity 200ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
    zIndex: 2,
  },
  cardInfo: {
    display: 'grid',
    gap: '5px',
    width: '100%',
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '1rem',
    color: 'var(--text-primary)',
    lineHeight: '1.25',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontWeight: '700',
    minWidth: 0,
  },
  cardTitleMobile: { fontSize: '0.85rem' },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: 'var(--text-muted)',
    fontSize: '0.76rem',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  cardMetaItem: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '1 1 0',
  },
  cardMetaDot: {
    opacity: 0.5,
    flexShrink: 0,
  },
};

export default ContentRail;
