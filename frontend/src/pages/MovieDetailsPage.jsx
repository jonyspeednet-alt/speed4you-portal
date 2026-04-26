import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { moviesService } from '../services/moviesService';
import { useBreakpoint } from '../hooks';
import { useRecentlyViewed } from '../hooks';
import WatchlistButton from '../components/ui/WatchlistButton';
import StarRating from '../components/ui/StarRating';

const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';
const MOVIE_CACHE_PREFIX = 'portal-movie-details-v1:';

function readMovieCache(slug) {
  if (typeof sessionStorage === 'undefined' || !slug) return null;
  try {
    const raw = sessionStorage.getItem(`${MOVIE_CACHE_PREFIX}${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeMovieCache(slug, movie) {
  if (typeof sessionStorage === 'undefined' || !slug || !movie) return;
  try {
    sessionStorage.setItem(`${MOVIE_CACHE_PREFIX}${slug}`, JSON.stringify(movie));
  } catch { /* ignore */ }
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function MovieDetailsSkeleton() {
  return (
    <div style={s.page}>
      <div style={s.hero}>
        <div style={{ ...s.skeletonBlock, position: 'absolute', inset: 0 }} />
        <div style={s.heroGradient} />
        <div style={s.heroInner}>
          <div style={{ ...s.skeletonBlock, width: 220, height: 330, borderRadius: 20, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...s.skeletonLine, width: 100, height: 12 }} />
            <div style={{ ...s.skeletonLine, width: '55%', height: 52 }} />
            <div style={{ ...s.skeletonLine, width: '80%', height: 16 }} />
            <div style={{ ...s.skeletonLine, width: '70%', height: 16 }} />
            <div style={{ ...s.skeletonLine, width: '60%', height: 16 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {[150, 180, 52].map((w, i) => (
                <div key={i} style={{ ...s.skeletonLine, width: w, height: 50, borderRadius: 999 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MovieDetailsPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const { slug } = useParams();
  const { addItem: trackView } = useRecentlyViewed();
  const [movie, setMovie] = useState(() => readMovieCache(slug));
  const [loading, setLoading] = useState(() => !readMovieCache(slug));
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cachedMovie = readMovieCache(slug);
        if (!cachedMovie) setLoading(true);
        setError('');
        const res = await moviesService.getById(slug);
        if (!cancelled) {
          setMovie(res);
          writeMovieCache(slug, res);
          trackView({ id: res.id, title: res.title, poster: res.poster, type: 'movie', year: res.year, genre: res.genre });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load movie details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug, trackView]);

  if (loading && !movie) return <MovieDetailsSkeleton />;
  if (error || !movie) {
    return (
      <div style={s.errorState}>
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{error || 'Movie not found.'}</p>
        <Link to="/browse" style={s.backLink}>← Browse movies</Link>
      </div>
    );
  }

  const genres = Array.isArray(movie.genres) && movie.genres.length
    ? movie.genres
    : String(movie.genre || '').split(',').map((g) => g.trim()).filter(Boolean);

  const runtime = movie.runtime ? `${movie.runtime} min` : null;
  const language = movie.language || movie.originalLanguage;
  const descLong = (movie.description || '').length > 180;

  return (
    <div style={s.page}>

      {/* ── Hero ── */}
      <section style={s.hero}>
        {/* Backdrop */}
        <div style={s.backdropWrap}>
          <img
            src={backdropError ? posterFallback : (movie.backdrop || movie.poster || posterFallback)}
            alt=""
            style={s.backdropImg}
            onError={() => setBackdropError(true)}
          />
          <div style={s.backdropBlur} />
          <div style={s.heroGradient} />
        </div>

        {/* Content */}
        <div style={{ ...s.heroInner, ...(isMobile ? s.heroInnerMobile : isTablet ? s.heroInnerTablet : {}) }}>

          {/* Poster */}
          <div style={{ ...s.posterWrap, ...(isMobile ? s.posterWrapMobile : {}) }}>
            <img
              src={posterError ? posterFallback : (movie.poster || posterFallback)}
              alt={movie.title}
              style={s.poster}
              onError={() => setPosterError(true)}
            />
          </div>

          {/* Info */}
          <div style={{ ...s.infoPanel, ...(isMobile ? s.infoPanelMobile : {}) }}>
            <div style={s.eyebrowRow}>
              <span style={s.eyebrow}>Feature Film</span>
              {movie.quality && <span style={s.qualityBadge}>{movie.quality}</span>}
            </div>

            <h1 style={{ ...s.title, ...(isMobile ? s.titleMobile : {}) }}>{movie.title}</h1>

            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p style={s.originalTitle}>{movie.originalTitle}</p>
            )}

            {/* Meta row */}
            <div style={s.metaRow}>
              <StarRating rating={movie.rating} size="sm" showNumber />
              {movie.year && <span style={s.metaChip}>{movie.year}</span>}
              {runtime && <span style={s.metaChip}>{runtime}</span>}
              {language && <span style={s.metaChip}>{language}</span>}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div style={s.genreRow}>
                {genres.map((g) => (
                  <Link key={g} to={`/browse?genre=${g}`} style={s.genreTag}>{g}</Link>
                ))}
              </div>
            )}

            {/* Description */}
            <div style={s.descWrap}>
              <p style={{
                ...s.description,
                ...(isMobile && !descExpanded ? s.descClamped : {}),
              }}>
                {movie.description || 'No description available.'}
              </p>
              {isMobile && descLong && (
                <button style={s.readMore} onClick={() => setDescExpanded((v) => !v)} aria-expanded={descExpanded}>
                  {descExpanded ? 'Show less ↑' : 'Read more ↓'}
                </button>
              )}
            </div>

            {/* Actions */}
            <div style={{ ...s.actions, ...(isMobile ? s.actionsMobile : {}) }}>
              <Link to={`/watch/${movie.id}`} style={{ ...s.playBtn, ...(isMobile ? s.btnFull : {}) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Now
              </Link>
              <WatchlistButton contentType="movie" contentId={movie.id} title={movie.title} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Details section ── */}
      <div style={s.body}>
        <div style={{ ...s.detailGrid, ...(isMobile ? s.detailGridMobile : {}) }}>

          {/* Stats */}
          <section style={s.card}>
            <h2 style={s.cardTitle}>Details</h2>
            <div style={s.statGrid}>
              {[
                { label: 'Year', value: movie.year },
                { label: 'Runtime', value: runtime || '—' },
                { label: 'Language', value: language || '—' },
                { label: 'Quality', value: movie.quality || 'HD' },
                { label: 'Rating', value: movie.rating ? `${movie.rating} / 10` : '—' },
                { label: 'Genre', value: genres.slice(0, 2).join(', ') || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={s.statItem}>
                  <span style={s.statLabel}>{label}</span>
                  <strong style={s.statValue}>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          {/* Description card — desktop only (mobile shows in hero) */}
          {!isMobile && movie.description && (
            <section style={s.card}>
              <h2 style={s.cardTitle}>Synopsis</h2>
              <p style={s.synopsisText}>{movie.description}</p>
            </section>
          )}
        </div>

        {/* Browse more */}
        <div style={s.browseMore}>
          {genres[0] && (
            <Link to={`/browse?genre=${genres[0]}`} style={s.browseBtn}>
              More {genres[0]} films →
            </Link>
          )}
          {language && (
            <Link to={`/browse?language=${language}`} style={s.browseBtn}>
              More {language} films →
            </Link>
          )}
          <Link to="/browse" style={s.browseBtn}>Browse all →</Link>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', paddingTop: 88 },

  errorState: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '120px 24px',
  },
  backLink: {
    marginTop: 12,
    color: 'var(--accent-cyan)',
    fontWeight: 700,
    fontSize: '0.9rem',
  },

  // Hero
  hero: {
    position: 'relative',
    minHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'flex-end',
  },
  backdropWrap: {
    position: 'absolute',
    inset: 0,
  },
  backdropImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center top',
  },
  backdropBlur: {
    position: 'absolute',
    inset: 0,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  heroGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to right, rgba(7,17,31,0.97) 0%, rgba(7,17,31,0.82) 40%, rgba(7,17,31,0.55) 70%, rgba(7,17,31,0.82) 100%), linear-gradient(to top, rgba(7,17,31,1) 0%, rgba(7,17,31,0.3) 40%, transparent 70%)',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 1400,
    margin: '0 auto',
    padding: '60px var(--spacing-lg) 52px',
    display: 'grid',
    gridTemplateColumns: '260px minmax(0,1fr)',
    gap: 40,
    alignItems: 'end',
  },
  heroInnerTablet: {
    gridTemplateColumns: '200px minmax(0,1fr)',
    gap: 28,
  },
  heroInnerMobile: {
    gridTemplateColumns: '1fr',
    gap: 20,
    padding: '24px var(--spacing-md) 32px',
    alignItems: 'start',
  },

  // Poster
  posterWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    aspectRatio: '2/3',
  },
  posterWrapMobile: {
    maxWidth: 160,
    margin: '0 auto',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },

  // Info panel
  infoPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  infoPanelMobile: {
    gap: 14,
  },

  eyebrowRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  qualityBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(255,90,95,0.18)',
    border: '1px solid rgba(255,90,95,0.3)',
    color: 'var(--accent-red)',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 'clamp(2rem, 4.5vw, 4.2rem)',
    color: 'var(--text-primary)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
  },
  titleMobile: {
    fontSize: 'clamp(1.6rem, 7vw, 2.4rem)',
  },
  originalTitle: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontStyle: 'italic',
    marginTop: -8,
  },

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaChip: {
    padding: '5px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },

  genreRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    padding: '6px 14px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    transition: 'all 150ms ease',
  },

  descWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  description: {
    color: 'var(--text-secondary)',
    lineHeight: 1.85,
    fontSize: '0.95rem',
    maxWidth: '64ch',
  },
  descClamped: {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  readMore: {
    color: 'var(--accent-cyan)',
    fontSize: '0.82rem',
    fontWeight: 700,
    background: 'none',
    border: 'none',
    padding: '2px 0',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    minHeight: 'unset',
    minWidth: 'unset',
  },

  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    paddingTop: 4,
  },
  actionsMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  playBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '14px 28px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #ff5a5f, #ff8a54)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.95rem',
    boxShadow: '0 8px 24px rgba(255,90,95,0.35)',
    transition: 'all 150ms ease',
  },
  btnFull: {
    width: '100%',
  },

  // Body
  body: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '36px var(--spacing-lg) var(--spacing-3xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.6fr',
    gap: 20,
    alignItems: 'start',
  },
  detailGridMobile: {
    gridTemplateColumns: '1fr',
  },

  card: {
    padding: '24px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  cardTitle: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 20,
    fontFamily: 'var(--font-family-ui)',
  },

  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px 12px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  statLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  statValue: {
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    fontWeight: 700,
    lineHeight: 1.4,
  },

  synopsisText: {
    color: 'var(--text-secondary)',
    lineHeight: 1.85,
    fontSize: '0.95rem',
  },

  browseMore: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  browseBtn: {
    padding: '10px 18px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 700,
    transition: 'all 150ms ease',
  },

  // Skeleton
  skeletonBlock: {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.3s linear infinite',
    borderRadius: 12,
  },
  skeletonLine: {
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.3s linear infinite',
  },
};
