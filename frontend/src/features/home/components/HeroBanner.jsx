import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useBreakpoint } from '../../../hooks';
import StarRating from '../../../components/ui/StarRating';
import WatchlistButton from '../../../components/ui/WatchlistButton';

function HeroBanner({ content }) {
  const { isMobile, isTablet } = useBreakpoint();
  const bgRef = useRef(null);

  // Parallax scroll effect (desktop only)
  useEffect(() => {
    if (isMobile || isTablet) return;
    function onScroll() {
      if (!bgRef.current) return;
      const y = window.scrollY;
      bgRef.current.style.transform = `scale(1.04) translateY(${y * 0.28}px)`;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile, isTablet]);
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
            <span style={styles.liveBadge}>Featured Tonight</span>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
              <span>{isPlaceholder ? 'Browse Latest' : isSeries ? 'Play From Start' : 'Watch Now'}</span>
            </Link>

            <Link to={isPlaceholder ? '/search' : isSeries ? `/series/${content.id}` : `/movies/${content.id}`} style={{ ...styles.infoBtn, ...(isMobile ? styles.infoBtnMobile : {}) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <span>{isPlaceholder ? 'Open Search' : 'View Details'}</span>
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
        {!isMobile && <div style={{ ...styles.sidePanel, ...(isTablet ? styles.sidePanelTablet : {}) }}>
          <div style={styles.sideCard}>
            <span style={styles.sideLabel}>Tonight's Mix</span>
            <h2 style={styles.sideTitle}>{isPlaceholder ? 'Catalog is warming up.' : 'Fast pick, premium feel.'}</h2>
            <p style={styles.sideText}>
              {isPlaceholder
                ? 'The hero now avoids fake demo movies. As soon as published content is available, this spotlight automatically switches to a real title from the live portal catalog.'
                : 'Cleaner artwork, clearer metadata, and stronger rotation keep the hero from feeling stuck on the same title every reload.'}
            </p>
            <div style={styles.sideStats}>
              <div style={styles.sideStat}>
                <span style={styles.sideStatLabel}>Status</span>
                <strong style={styles.sideStatValue}>{isPlaceholder ? 'Waiting for live titles' : 'Live spotlight'}</strong>
              </div>
              <div style={styles.sideStat}>
                <span style={styles.sideStatLabel}>Refresh</span>
                <strong style={styles.sideStatValue}>{isPlaceholder ? 'Auto after publish' : 'Rotates through the day'}</strong>
              </div>
            </div>
          </div>

          <div style={styles.sidePosterCard}>
            <span style={styles.sidePosterBadge}>{isPlaceholder ? 'Portal Spotlight' : isSeries ? 'Series Spotlight' : 'Movie Spotlight'}</span>
            <div style={styles.sidePoster}>
              {hasPoster ? (
                <img
                  src={content.poster}
                  alt={content.title}
                  style={styles.sidePosterImage}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              ) : (
                <div style={styles.sidePosterFallback}>
                  <span style={styles.sidePosterMini}>{isPlaceholder ? 'Fresh drops will appear here' : 'Featured tonight'}</span>
                  <strong style={styles.sidePosterTitle}>{content.title}</strong>
                </div>
              )}
            </div>
          </div>
        </div>}
      </div>
    </section>
  );
}

const styles = {
  hero: {
    position: 'relative',
    minHeight: '88vh',
    overflow: 'hidden',
    paddingTop: '84px',
  },
  heroTablet: {
    minHeight: '70vh',
    paddingTop: '76px',
  },
  heroMobile: {
    paddingTop: '64px',
    minHeight: 'min(100svh, 100dvh)',
  },
  background: {
    position: 'absolute',
    inset: 0,
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center top',
    transform: 'scale(1.04)',
    filter: 'saturate(1.08) contrast(1.04)',
    transition: 'opacity 220ms ease',
  },
  bgFallback: {
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle at 20% 20%, rgba(125,249,255,0.18), transparent 24%), radial-gradient(circle at 80% 18%, rgba(255,90,95,0.22), transparent 20%), linear-gradient(135deg, #08111d 0%, #12233a 50%, #33161c 100%)',
  },
  backdropWash: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(112deg, rgba(7,17,31,0.92) 12%, rgba(7,17,31,0.5) 48%, rgba(255,90,95,0.12) 100%)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 82% 20%, rgba(125,249,255,0.16), transparent 16%), linear-gradient(to top, rgba(5,12,22,0.98) 4%, rgba(5,12,22,0.28) 48%, rgba(5,12,22,0.8) 100%)',
  },
  contentWrap: {
    position: 'relative',
    zIndex: 2,
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: 'calc(88vh - 84px)',
    padding: 'var(--spacing-3xl) var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 360px)',
    alignItems: 'end',
    gap: 'var(--spacing-2xl)',
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
    background: 'linear-gradient(180deg, rgba(7,17,31,0.42), rgba(7,17,31,0.7))',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-hero)',
    maxWidth: '760px',
  },
  copyPanelMobile: {
    padding: '0',
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    backdropFilter: 'none',
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
    fontSize: 'clamp(3.4rem, 6vw, 6rem)',
    marginBottom: 'var(--spacing-md)',
    maxWidth: '9ch',
    textWrap: 'balance',
    color: 'var(--text-primary)',
    textShadow: '0 6px 24px rgba(0, 0, 0, 0.28)',
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
