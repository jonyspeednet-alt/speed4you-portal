import { useRef, useState } from 'react';
import WatchlistButton from '../../../components/ui/WatchlistButton';
import { useBreakpoint, useTVMode } from '../../../hooks';

function ContentRail({ title, items, type = 'default', subtitle = 'Curated now', viewAllLink, priorityCount = 0, onQuickView }) {
  const scrollRef = useRef(null);
  const { isMobile, isTablet } = useBreakpoint();
  const isTVMode = useTVMode();
  const [leftHovered, setLeftHovered] = useState(false);
  const [rightHovered, setRightHovered] = useState(false);

  const accent = title.includes('Bengali')
    ? 'var(--accent-violet)'
    : title.includes('Trending')
      ? 'var(--accent-pink)'
      : 'var(--accent-cyan)';

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction === 'left' ? -380 : 380, behavior: 'smooth' });
  };

  return (
    <section style={styles.section}>
      <div style={{ ...styles.header, ...(isTVMode ? styles.headerTV : isMobile ? styles.headerMobile : {}) }}>
        <div>
          <span style={{ ...styles.eyebrow, color: accent }}>{subtitle}</span>
          <h2 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>{title}</h2>
        </div>

        <div style={styles.headerActions}>
          {viewAllLink ? <a href={viewAllLink} style={styles.viewAll}>Open shelf</a> : null}
          {!isMobile && (
            <div style={styles.controls}>
              <button type="button" aria-label={`Scroll ${title} left`} onClick={() => scroll('left')} onMouseEnter={() => setLeftHovered(true)} onMouseLeave={() => setLeftHovered(false)} style={{ ...styles.arrow, ...(leftHovered ? styles.arrowHover : {}) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <button type="button" aria-label={`Scroll ${title} right`} onClick={() => scroll('right')} onMouseEnter={() => setRightHovered(true)} onMouseLeave={() => setRightHovered(false)} style={{ ...styles.arrow, ...(rightHovered ? styles.arrowHover : {}) }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...styles.rail, ...(isTVMode ? styles.railTV : isMobile ? styles.railMobile : {}) }} ref={scrollRef}>
        {items.map((item, index) => (
          <ContentCard
            key={item.id}
            item={item}
            type={type}
            eager={index < priorityCount}
            compact={isMobile}
            tablet={isTablet}
            tv={isTVMode}
            onQuickView={() => onQuickView && onQuickView(item)}
          />
        ))}
      </div>
    </section>
  );
}

function ContentCard({ item, type, eager, compact, tablet, tv, onQuickView }) {
  const isSeries = type === 'series' || item.type === 'series';
  const isLandscape = type === 'continue';
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const genre = String(item.genre || 'Featured').split(',')[0].trim();

  return (
    <article
      className={`content-rail-card ${tv ? 'tv-mode-card' : ''}`}
      style={{
        ...styles.cardWrap,
        ...(isLandscape ? styles.cardWrapLandscape : {}),
        ...(tv ? (isLandscape ? styles.cardWrapLandscapeTV : styles.cardWrapTV) : compact ? styles.cardWrapMobile : tablet ? styles.cardWrapTablet : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button 
        type="button" 
        className="content-card-trigger"
        style={styles.cardButton} 
        onClick={onQuickView}
        onFocus={() => tv && setHovered(true)}
        onBlur={() => tv && setHovered(false)}
      >
        <div
          style={{
            ...styles.posterWrap,
            aspectRatio: isLandscape ? '16 / 9' : '2 / 3',
            transform: hovered && !compact ? 'translateY(-8px) scale(1.03)' : 'translateY(0) scale(1)',
            boxShadow: hovered && !compact
              ? '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,255,0.2), 0 0 40px rgba(0,255,255,0.1)'
              : '0 8px 32px rgba(0,0,0,0.4)',
            borderColor: hovered && !compact ? 'rgba(0,255,255,0.3)' : 'rgba(255,255,255,0.08)',
          }}
        >
          {!imgLoaded ? <div style={styles.posterPlaceholder}><div style={styles.posterShimmer} /></div> : null}
          <img
            src={item.poster}
            alt={item.title}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'low'}
            style={{
              ...styles.poster,
              opacity: imgLoaded ? 1 : 0,
              transform: hovered && !compact ? 'scale(1.06)' : 'scale(1)',
            }}
            onLoad={() => setImgLoaded(true)}
          />
          <div style={styles.posterOverlay} />

          {/* Top badges */}
          <div style={styles.topBadges}>
            <span style={styles.typeBadge}>{isSeries ? 'Series' : 'Movie'}</span>
            {item.rating ? (
              <span style={styles.ratingBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--accent-tertiary)" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {item.rating}
              </span>
            ) : null}
          </div>

          {/* Bottom info on poster */}
          <div style={styles.posterBottom}>
            <h3 style={styles.posterTitle}>{item.title}</h3>
            <div style={styles.posterMeta}>
              <span style={styles.genrePill}>{genre}</span>
              {item.year ? <span style={styles.yearText}>{item.year}</span> : null}
              <span style={styles.langText}>{item.language || 'Mixed'}</span>
            </div>
          </div>

          {/* Hover play overlay */}
          {!compact && hovered ? (
            <div style={styles.hoverOverlay}>
              <div style={styles.playCircle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#08111d" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <span style={styles.hoverLabel}>Quick View</span>
            </div>
          ) : null}
        </div>

        {/* Card info below poster */}
        <div style={styles.cardInfo}>
          <div className="content-rail-meta" style={styles.cardMeta}>
            <span>{genre}</span>
            <span style={styles.metaDot}>·</span>
            <span>{item.language || 'Mixed'}</span>
            {item.year ? <><span style={styles.metaDot}>·</span><span>{item.year}</span></> : null}
          </div>
        </div>
      </button>

      <div style={styles.watchlistSlot}>
        <WatchlistButton
          contentType={isSeries ? 'series' : 'movie'}
          contentId={item.id}
          title={item.title}
          compact
        />
      </div>
    </article>
  );
}

const styles = {
  section: {
    padding: 'var(--spacing-md) 0 var(--spacing-lg)',
  },
  header: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'end',
    gap: '14px',
  },
  headerMobile: {
    width: 'min(1440px, calc(100vw - 24px))',
    alignItems: 'start',
  },
  headerTV: {
    width: 'min(1720px, calc(100vw - 96px))',
    marginBottom: '24px',
  },
  eyebrow: {
    display: 'inline-block',
    marginBottom: '6px',
    fontSize: '0.7rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
  },
  titleMobile: {
    fontSize: '1.35rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  viewAll: {
    padding: '9px 14px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    color: 'var(--text-muted)',
    fontSize: '0.76rem',
    fontWeight: '700',
    letterSpacing: '0.04em',
  },
  controls: {
    display: 'flex',
    gap: '6px',
  },
  arrow: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    color: 'var(--text-muted)',
    display: 'grid',
    placeItems: 'center',
  },
  arrowHover: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  rail: {
    display: 'flex',
    gap: '16px',
    padding: '6px max(24px, calc((100vw - 1440px) / 2)) 16px',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
  },
  railMobile: {
    gap: '12px',
    padding: '4px 12px 8px',
  },
  railTV: {
    gap: '20px',
    padding: '6px max(48px, calc((100vw - 1720px) / 2)) 16px',
  },
  cardWrap: {
    position: 'relative',
    flex: '0 0 auto',
    width: '220px',
    scrollSnapAlign: 'start',
  },
  cardWrapLandscape: {
    width: '360px',
  },
  cardWrapLandscapeTV: {
    width: '420px',
  },
  cardWrapTV: {
    width: '280px',
  },
  cardWrapTablet: {
    width: '196px',
  },
  cardWrapMobile: {
    width: '156px',
  },
  cardButton: {
    width: '100%',
    textAlign: 'left',
    display: 'grid',
    gap: '10px',
  },
  posterWrap: {
    position: 'relative',
    aspectRatio: '2 / 3',
    borderRadius: '14px',
    overflow: 'hidden',
    background: '#0d1a2d',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  posterPlaceholder: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255, 255, 255, 0.03)',
  },
  posterShimmer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.8s linear infinite',
  },
  poster: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease',
  },
  posterOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.08) 45%, rgba(7,17,31,0.88) 100%)',
    pointerEvents: 'none',
  },
  topBadges: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    right: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '6px',
    zIndex: 1,
  },
  typeBadge: {
    padding: '5px 10px',
    borderRadius: '6px',
    background: 'rgba(5, 12, 22, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#ffffff',
    fontSize: '0.62rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  ratingBadge: {
    padding: '5px 9px',
    borderRadius: '6px',
    background: 'rgba(5, 12, 22, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'var(--accent-cyan)',
    fontSize: '0.7rem',
    fontWeight: '900',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  posterBottom: {
    position: 'absolute',
    left: '10px',
    right: '10px',
    bottom: '10px',
    zIndex: 1,
  },
  posterTitle: {
    color: '#fff',
    fontSize: '0.88rem',
    fontWeight: '700',
    lineHeight: '1.3',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginBottom: '6px',
    textShadow: '0 2px 10px rgba(0,0,0,0.6)',
    letterSpacing: '-0.01em',
  },
  posterMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  genrePill: {
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: '0.62rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  yearText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.68rem',
    fontWeight: '600',
  },
  langText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.66rem',
    fontWeight: '600',
  },
  hoverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(2px)',
    zIndex: 2,
  },
  playCircle: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    paddingLeft: '3px',
  },
  hoverLabel: {
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  cardInfo: {
    padding: '0 2px',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    textTransform: 'capitalize',
  },
  metaDot: {
    opacity: 0.4,
    fontSize: '0.6rem',
  },
  watchlistSlot: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 3,
  },
};

export default ContentRail;
