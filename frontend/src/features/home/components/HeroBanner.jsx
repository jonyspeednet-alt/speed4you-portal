import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks';
import StarRating from '../../../components/ui/StarRating';
import WatchlistButton from '../../../components/ui/WatchlistButton';

function HeroBanner({ content: contentItems }) {
  const { isMobile, isTablet } = useBreakpoint();
  const bgRef = useRef(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  
  React.useEffect(() => {
    if (!Array.isArray(contentItems) || contentItems.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % contentItems.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [contentItems]);

  const content = Array.isArray(contentItems) ? contentItems[activeIndex] : contentItems;

  // Parallax scroll effect (desktop only)
  useEffect(() => {
    if (!content || isMobile || isTablet) return;
    function onScroll() {
      if (!bgRef.current) return;
      const y = window.scrollY;
      bgRef.current.style.transform = `scale(1.04) translateY(${y * 0.28}px)`;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [content, isMobile, isTablet]);

  if (!content) return null;

  const heroImage = content.backdrop || content.poster || '';
  const hasPoster = Boolean(content.poster);
  const isSeries = content.type === 'series';
  const isPlaceholder = Boolean(content.isPlaceholder);
  const heroChips = [content.genre, content.language, content.year].filter(Boolean).slice(0, 3);
  
  const insightItems = [
    { label: 'Format', value: isPlaceholder ? 'Spotlight' : isSeries ? 'Series' : 'Movie' },
    { label: 'Rating', value: content.rating || 'N/A', isRating: true },
    { label: 'Language', value: content.language || 'Mixed' },
  ];

  return (
    <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
      <div style={styles.background}>
        <div style={styles.bgFallback} />
        {heroImage ? (
          <img
            ref={bgRef}
            src={heroImage}
            alt={content.title}
            style={styles.bgImage}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            sizes="100vw"
          />
        ) : null}
        <div style={styles.backdropWash} />
        <div style={styles.overlay} />
        {Array.isArray(contentItems) && contentItems.length > 1 && (
          <div style={styles.carouselDots}>
            {contentItems.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setActiveIndex(i)}
                style={i === activeIndex ? styles.dotActive : styles.dot}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ ...styles.contentWrap, ...(isMobile ? styles.contentWrapMobile : isTablet ? styles.contentWrapTablet : {}) }}>
        {isMobile && hasPoster ? (
          <div style={styles.mobilePosterDock}>
            <img
              src={content.poster}
              alt={content.title}
              style={styles.mobilePoster}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            <div style={styles.mobilePosterGlow} />
          </div>
        ) : null}

        <div style={{ ...styles.copyPanel, ...(isMobile ? styles.copyPanelMobile : {}) }}>
          <div style={styles.kickerRow}>
            <span style={styles.liveBadge}>FEATURED TONIGHT</span>
            <span style={styles.genre}>{content.genre}</span>
            <span style={styles.year}>{content.year}</span>
          </div>

          <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>{content.title}</h1>
          <p style={{ ...styles.description, ...(isMobile ? styles.descriptionMobile : {}) }}>{content.description}</p>

          <div style={styles.chipRow}>
            {heroChips.map((chip) => (
              <span key={chip} style={styles.heroChip}>{chip}</span>
            ))}
          </div>

          <div style={{ ...styles.metricRow, ...(isMobile ? styles.metricRowMobile : {}) }}>
            {insightItems.map((item) => (
              <div key={item.label} style={{ ...styles.metricStat, ...(isMobile ? styles.metricStatMobile : {}) }}>
                <span style={styles.metricLabel}>{item.label}</span>
                {item.isRating && content.rating ? (
                  <StarRating rating={content.rating} size="sm" showNumber />
                ) : (
                  <strong style={styles.metricValue}>{item.value}</strong>
                )}
              </div>
            ))}
          </div>

          <div style={{ ...styles.actions, ...(isMobile ? styles.actionsMobile : {}) }}>
            <Link to={isPlaceholder ? '/browse?sort=latest' : `/watch/${content.id}`} style={{ ...styles.playBtn, ...(isMobile ? styles.playBtnMobile : {}) }}>
              {isPlaceholder ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              <span>{isPlaceholder ? 'Browse Latest' : isSeries ? 'Start Watching' : 'Play Now'}</span>
            </Link>

            <Link to={isPlaceholder ? '/search' : isSeries ? `/series/${content.id}` : `/movies/${content.id}`} style={{ ...styles.infoBtn, ...(isMobile ? styles.infoBtnMobile : {}) }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <span>{isPlaceholder ? 'Search Portal' : 'Details'}</span>
            </Link>

            {!isPlaceholder && (
              <WatchlistButton
                contentType={isSeries ? 'series' : 'movie'}
                contentId={content.id}
                title={content.title}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const styles = {
  hero: {
    position: 'relative',
    minHeight: '92vh',
    overflow: 'hidden',
    paddingTop: 'var(--nav-height-desktop)',
    background: 'var(--bg-primary)',
  },
  heroTablet: {
    minHeight: '75vh',
  },
  heroMobile: {
    paddingTop: 'var(--nav-height-mobile)',
    minHeight: 'min(100svh, 100dvh)',
  },
  background: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 20%',
    transform: 'scale(1.1)',
    filter: 'saturate(1.1) contrast(1.1)',
    transition: 'opacity 0.8s ease-in-out',
    animation: 'softFloat 20s ease-in-out infinite alternate',
  },
  bgFallback: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #050b16 0%, #0a1222 100%)',
  },
  backdropWash: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(112deg, rgba(5,11,22,0.95) 15%, rgba(5,11,22,0.4) 50%, rgba(0,245,212,0.1) 100%)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, var(--bg-primary) 2%, rgba(5,11,22,0.2) 40%, rgba(5,11,22,0.7) 100%)',
  },
  contentWrap: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: 'calc(88vh - 84px)',
    padding: 'var(--spacing-3xl) var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 800px)',
    alignItems: 'end',
    animation: 'fadeUp 620ms ease both',
  },
  contentWrapTablet: {
    minHeight: 'auto',
    gridTemplateColumns: '1fr',
    gap: '20px',
    padding: 'var(--spacing-2xl) var(--spacing-lg)',
  },
  contentWrapMobile: {
    minHeight: 'auto',
    gridTemplateColumns: '1fr',
    gap: '14px',
    padding: '12px var(--spacing-md) var(--spacing-2xl)',
  },
  mobilePosterDock: {
    position: 'relative',
    width: 'min(54vw, 220px)',
    margin: '0 auto',
  },
  mobilePoster: {
    width: '100%',
    aspectRatio: '2 / 3',
    objectFit: 'cover',
    borderRadius: '24px',
    boxShadow: '0 22px 50px rgba(0,0,0,0.34)',
    border: '1px solid rgba(255,255,255,0.14)',
  },
  mobilePosterGlow: {
    position: 'absolute',
    inset: '-14px',
    background: 'radial-gradient(circle, rgba(255,90,95,0.2), transparent 65%)',
    zIndex: -1,
    filter: 'blur(14px)',
  },
  copyPanel: {
    padding: 'var(--spacing-2xl)',
    borderRadius: 'var(--radius-xl)',
    background: 'transparent',
    maxWidth: '800px',
  },
  copyPanelMobile: {
    padding: '0',
    background: 'transparent',
  },
  kickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: 'var(--spacing-lg)',
  },
  liveBadge: {
    padding: '0.45rem 0.9rem',
    borderRadius: '999px',
    background: 'rgba(255, 200, 87, 0.14)',
    border: '1px solid rgba(255, 200, 87, 0.35)',
    color: 'var(--accent-amber)',
    fontSize: '0.78rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  genre: {
    color: 'var(--accent-cyan)',
    fontSize: '0.82rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  year: {
    color: 'var(--text-muted)',
    fontSize: '0.92rem',
  },
  title: {
    fontSize: 'clamp(3rem, 5vw, 4.5rem)',
    marginBottom: 'var(--spacing-md)',
    maxWidth: '12ch',
    textWrap: 'balance',
    color: 'var(--text-primary)',
    textShadow: '0 4px 18px rgba(0, 0, 0, 0.4)',
  },
  titleMobile: {
    fontSize: 'clamp(2rem, 8vw, 2.8rem)',
    marginBottom: 'var(--spacing-sm)',
  },
  description: {
    maxWidth: '58ch',
    fontSize: '1.04rem',
    lineHeight: '1.8',
    marginBottom: 'var(--spacing-xl)',
    color: 'var(--text-secondary)',
  },
  descriptionMobile: {
    fontSize: '0.92rem',
    lineHeight: '1.6',
    marginBottom: 'var(--spacing-md)',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: 'var(--spacing-lg)',
  },
  heroChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.48rem 0.9rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  metricRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    marginBottom: 'var(--spacing-xl)',
  },
  metricRowMobile: {
    gap: '8px',
    marginBottom: 'var(--spacing-md)',
  },
  metricStat: {
    minWidth: '130px',
    padding: '14px 16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  metricStatMobile: {
    minWidth: '0',
    flex: '1 1 calc(33% - 8px)',
    padding: '10px 12px',
    borderRadius: '14px',
  },
  metricLabel: {
    display: 'block',
    marginBottom: '6px',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  metricValue: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontWeight: '700',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    flexWrap: 'wrap',
  },
  actionsMobile: {
    gap: '10px',
  },
  playBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    minWidth: '164px',
    padding: '14px 24px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff7d45)',
    color: '#fffdf9',
    fontWeight: '700',
    letterSpacing: '0.01em',
    boxShadow: '0 12px 30px rgba(255, 90, 95, 0.35)',
  },
  playBtnMobile: {
    flex: 1,
    minWidth: '0',
    padding: '13px 18px',
    fontSize: '0.92rem',
  },
  infoBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    minWidth: '168px',
    padding: '14px 24px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    backdropFilter: 'blur(10px)',
  },
  infoBtnMobile: {
    flex: 1,
    minWidth: '0',
    padding: '13px 18px',
    fontSize: '0.92rem',
  },
  buttonIcon: {
    flexShrink: 0,
  },
  sidePanel: {
    display: 'grid',
    gap: '16px',
  },
  sidePanelTablet: {
    gap: '12px',
  },
  sidePanelMobile: {
    gap: '10px',
  },
  sideCard: {
    padding: '20px',
    borderRadius: '28px',
    background: 'linear-gradient(180deg, rgba(11, 24, 39, 0.94), rgba(11, 24, 39, 0.72))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-card)',
    backdropFilter: 'blur(16px)',
  },
  sideLabel: {
    display: 'inline-block',
    marginBottom: '12px',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  sideTitle: {
    fontSize: '1.4rem',
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  sideText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
  },
  sideStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '16px',
  },
  sideStat: {
    padding: '12px 14px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  sideStatLabel: {
    display: 'block',
    marginBottom: '6px',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: '700',
  },
  sideStatValue: {
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    fontWeight: '700',
    lineHeight: '1.4',
  },
  sidePosterCard: {
    padding: '18px',
    borderRadius: '28px',
    background: 'linear-gradient(180deg, rgba(11, 24, 39, 0.94), rgba(11, 24, 39, 0.72))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-card)',
    backdropFilter: 'blur(16px)',
  },
  sidePosterBadge: {
    display: 'inline-flex',
    marginBottom: '12px',
    padding: '0.34rem 0.72rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--accent-amber)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.68rem',
    fontWeight: '700',
  },
  sidePoster: {
    borderRadius: '22px',
    overflow: 'hidden',
    aspectRatio: '4 / 5',
  },
  sidePosterImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  sidePosterFallback: {
    width: '100%',
    height: '100%',
    display: 'grid',
    alignContent: 'end',
    gap: '10px',
    padding: '18px',
    background: 'linear-gradient(160deg, rgba(21, 44, 71, 0.96), rgba(10, 19, 33, 0.98) 62%, rgba(126, 36, 44, 0.95))',
    color: 'var(--text-primary)',
  },
  sidePosterMini: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  sidePosterTitle: {
    fontSize: '1.2rem',
    lineHeight: '1.2',
    textWrap: 'balance',
  },
};

export default HeroBanner;
