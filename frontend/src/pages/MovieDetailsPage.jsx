import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { moviesService } from '../services/apiClient';
import { useBreakpoint } from '../hooks';

const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';
const MOVIE_CACHE_PREFIX = 'portal-movie-details-v1:';

function readMovieCache(slug) {
  if (typeof sessionStorage === 'undefined' || !slug) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(`${MOVIE_CACHE_PREFIX}${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMovieCache(slug, movie) {
  if (typeof sessionStorage === 'undefined' || !slug || !movie) {
    return;
  }

  try {
    sessionStorage.setItem(`${MOVIE_CACHE_PREFIX}${slug}`, JSON.stringify(movie));
  } catch {
    // Ignore cache write failures.
  }
}

function MovieDetailsPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const { slug } = useParams();
  const cachedMovie = readMovieCache(slug);
  const [movie, setMovie] = useState(cachedMovie);
  const [loading, setLoading] = useState(!cachedMovie);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadMovie() {
      try {
        if (!cachedMovie) {
          setLoading(true);
        }
        setError('');
        const response = await moviesService.getById(slug);
        if (!cancelled) {
          setMovie(response);
          writeMovieCache(slug, response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load movie details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMovie();

    return () => {
      cancelled = true;
    };
  }, [cachedMovie, slug]);

  if (loading && !movie) {
    return <MovieDetailsSkeleton />;
  }

  if (error || !movie) {
    return <div style={styles.state}>{error || 'Movie not found.'}</div>;
  }

  const movieGenres = Array.isArray(movie.genres) && movie.genres.length
    ? movie.genres
    : String(movie.genre || '').split(',').map((entry) => entry.trim()).filter(Boolean);

  const detailItems = [
    { label: 'Original Title', value: movie.originalTitle || movie.title },
    { label: 'Language', value: movie.language || movie.originalLanguage || 'Unknown' },
    { label: 'Runtime', value: movie.runtime ? `${movie.runtime} min` : 'Runtime unavailable' },
    { label: 'Quality', value: movie.quality || 'HD' },
  ];

  const metadataItems = [
    movie.metadataProvider || 'manual',
    movie.metadataStatus || 'pending',
    movie.originalLanguage || 'n/a',
    movie.tmdbId ? `TMDB ${movie.tmdbId}` : 'TMDB n/a',
    movie.imdbId ? `IMDb ${movie.imdbId}` : 'IMDb n/a',
  ];

  return (
    <div style={styles.page}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div style={styles.backdrop}>
          <img src={movie.backdrop || movie.poster || posterFallback} alt={movie.title} style={styles.bgImage} />
          <div style={styles.heroGradient} />
        </div>

        <div style={{ ...styles.heroContent, ...(isMobile ? styles.heroContentMobile : isTablet ? styles.heroContentTablet : {}) }}>
          <div style={{ ...styles.posterWrapper, ...(isMobile ? styles.posterWrapperMobile : {}) }}>
            <img src={movie.poster || posterFallback} alt={movie.title} style={styles.poster} />
          </div>

          <div style={{ ...styles.infoPanel, ...(isMobile ? styles.infoPanelMobile : {}) }}>
            <span style={styles.eyebrow}>Feature Film</span>
            <h1 style={styles.title}>{movie.title}</h1>

            <div style={styles.meta}>
              <span style={styles.rating}>★ {movie.rating || 'N/A'}</span>
              <span>{movie.year}</span>
              <span style={styles.quality}>{movie.quality || 'HD'}</span>
              <span>{movie.runtime ? `${movie.runtime} min` : 'Runtime unavailable'}</span>
              <span>{movie.language || movie.originalLanguage || 'Unknown'}</span>
            </div>

            <div style={styles.genres}>
              {movieGenres.map((genre) => (
                <Link key={genre} to={`/browse?genre=${genre}`} style={styles.genreTag}>{genre}</Link>
              ))}
            </div>

            <p style={styles.description}>{movie.description || 'Description not available yet.'}</p>

            <div style={styles.actions}>
              <Link to={`/watch/${movie.id}`} style={styles.playBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Watch Movie</span>
              </Link>

              <Link to={`/browse?language=${movie.language || movie.originalLanguage || 'English'}`} style={styles.secondaryBtn}>
                Explore Similar Language
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div style={styles.content}>
        <section style={{ ...styles.commandStrip, ...(isMobile ? styles.commandStripMobile : {}) }}>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Viewer Fit</span>
            <strong style={styles.commandValue}>Best for a single-sitting watch night.</strong>
          </div>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Next Move</span>
            <strong style={styles.commandValue}>Start now or jump into related genre shelves.</strong>
          </div>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Catalog Context</span>
            <strong style={styles.commandValue}>{movieGenres.slice(0, 2).join(' | ') || 'Featured title'}</strong>
          </div>
        </section>

        <div style={{ ...styles.detailGrid, ...(isMobile ? styles.detailGridMobile : {}) }}>
          <section style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>At A Glance</h2>
            <div style={styles.detailList}>
              {detailItems.map((item) => (
                <div key={item.label} style={styles.detailRow}>
                  <span style={styles.detailLabel}>{item.label}</span>
                  <strong style={styles.detailValue}>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.sectionCard}>
            <h2 style={styles.sectionTitle}>Metadata Footprint</h2>
            <div style={styles.subtitles}>
              {metadataItems.map((item) => (
                <span key={item} style={styles.subtitleTag}>{item}</span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MovieDetailsSkeleton() {
  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.backdrop}>
          <div style={{ ...styles.skeletonBlock, ...styles.skeletonBackdrop }} />
          <div style={styles.heroGradient} />
        </div>

        <div style={styles.heroContent}>
          <div style={{ ...styles.posterWrapper, ...styles.skeletonBlock, ...styles.skeletonPoster }} />

          <div style={styles.infoPanel}>
            <div style={{ ...styles.skeletonLine, width: '120px', height: '12px', marginBottom: '18px' }} />
            <div style={{ ...styles.skeletonLine, width: '58%', height: '56px', marginBottom: '16px' }} />
            <div style={{ ...styles.skeletonLine, width: '82%', height: '18px', marginBottom: '10px' }} />
            <div style={{ ...styles.skeletonLine, width: '74%', height: '18px', marginBottom: '24px' }} />
            <div style={styles.skeletonChipRow}>
              <div style={{ ...styles.skeletonPill, width: '96px' }} />
              <div style={{ ...styles.skeletonPill, width: '110px' }} />
              <div style={{ ...styles.skeletonPill, width: '88px' }} />
            </div>
            <div style={{ ...styles.skeletonLine, width: '100%', height: '16px', marginBottom: '10px' }} />
            <div style={{ ...styles.skeletonLine, width: '92%', height: '16px', marginBottom: '10px' }} />
            <div style={{ ...styles.skeletonLine, width: '76%', height: '16px', marginBottom: '26px' }} />
            <div style={styles.skeletonActionRow}>
              <div style={{ ...styles.skeletonPill, width: '150px', height: '52px' }} />
              <div style={{ ...styles.skeletonPill, width: '190px', height: '52px' }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const styles = {
  state: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '120px 24px 24px',
    color: 'var(--text-secondary)',
  },
  page: {
    minHeight: '100vh',
    paddingTop: '92px',
  },
  hero: {
    position: 'relative',
    minHeight: '82vh',
    overflow: 'hidden',
  },
  heroMobile: {
    minHeight: 'auto',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(120deg, rgba(7,17,31,0.92) 18%, rgba(7,17,31,0.42) 55%, rgba(7,17,31,0.86) 100%)',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: '82vh',
    padding: 'var(--spacing-3xl) var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: '300px minmax(0, 1fr)',
    gap: 'var(--spacing-2xl)',
    alignItems: 'end',
  },
  heroContentTablet: {
    gridTemplateColumns: '220px minmax(0, 1fr)',
  },
  heroContentMobile: {
    minHeight: 'auto',
    gridTemplateColumns: '1fr',
    gap: '14px',
    alignItems: 'start',
    padding: '18px var(--spacing-md) var(--spacing-2xl)',
  },
  posterWrapper: {
    borderRadius: '28px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-hero)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  posterWrapperMobile: {
    maxWidth: '220px',
    margin: '0 auto',
  },
  poster: {
    width: '100%',
    height: 'auto',
  },
  infoPanel: {
    padding: '30px',
    borderRadius: '32px',
    background: 'rgba(7,17,31,0.42)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(14px)',
    boxShadow: 'var(--shadow-soft)',
  },
  infoPanelMobile: {
    padding: '18px',
    borderRadius: '24px',
  },
  eyebrow: {
    display: 'inline-block',
    marginBottom: '14px',
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  title: {
    fontSize: 'clamp(2.6rem, 5vw, 4.8rem)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-md)',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-md)',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    flexWrap: 'wrap',
  },
  rating: {
    color: 'var(--accent-amber)',
    fontWeight: '700',
  },
  quality: {
    background: 'rgba(255,90,95,0.16)',
    color: 'var(--accent-red)',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  genres: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: 'var(--spacing-lg)',
  },
  genreTag: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  description: {
    color: 'var(--text-secondary)',
    lineHeight: '1.9',
    maxWidth: '68ch',
    marginBottom: 'var(--spacing-xl)',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
  },
  playBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 20px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, var(--accent-cyan), #29b6f6)',
    color: '#07111f',
    fontWeight: '800',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 20px',
    borderRadius: '999px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.16)',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: 'var(--spacing-2xl) var(--spacing-lg) var(--spacing-3xl)',
    display: 'grid',
    gap: '22px',
  },
  commandStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  commandStripMobile: {
    gridTemplateColumns: '1fr',
  },
  commandCard: {
    padding: '22px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  commandLabel: {
    display: 'block',
    marginBottom: '10px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  commandValue: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
    lineHeight: '1.5',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '22px',
  },
  detailGridMobile: {
    gridTemplateColumns: '1fr',
  },
  sectionCard: {
    padding: '26px',
    borderRadius: '28px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  sectionTitle: {
    color: 'var(--text-primary)',
    marginBottom: '18px',
    fontSize: '1.3rem',
  },
  detailList: {
    display: 'grid',
    gap: '18px',
  },
  detailRow: {
    display: 'grid',
    gap: '8px',
  },
  detailLabel: {
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  detailValue: {
    color: 'var(--text-primary)',
    lineHeight: '1.6',
  },
  subtitles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  subtitleTag: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
  },
  skeletonBlock: {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.2s linear infinite',
  },
  skeletonBackdrop: {
    width: '100%',
    height: '100%',
  },
  skeletonPoster: {
    minHeight: '440px',
  },
  skeletonLine: {
    borderRadius: '999px',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.2s linear infinite',
  },
  skeletonChipRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '24px',
  },
  skeletonPill: {
    height: '36px',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.2s linear infinite',
  },
  skeletonActionRow: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
  },
};

export default MovieDetailsPage;
