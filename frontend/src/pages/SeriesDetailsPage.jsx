import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { seriesService } from '../services/apiClient';
import { useBreakpoint } from '../hooks';

const posterFallback = 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400';
const SERIES_CACHE_PREFIX = 'portal-series-details-v1:';

function toPositiveInt(value, fallback) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.floor(asNumber);
  }

  const match = String(value || '').match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

function readSeriesCache(slug) {
  if (typeof sessionStorage === 'undefined' || !slug) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(`${SERIES_CACHE_PREFIX}${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSeriesCache(slug, series) {
  if (typeof sessionStorage === 'undefined' || !slug || !series) {
    return;
  }

  try {
    sessionStorage.setItem(`${SERIES_CACHE_PREFIX}${slug}`, JSON.stringify(series));
  } catch {
    // Ignore cache write failures.
  }
}

function SeriesDetailsPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const { slug } = useParams();
  const cachedSeries = readSeriesCache(slug);
  const [activeSeason, setActiveSeason] = useState(0);
  const [series, setSeries] = useState(cachedSeries);
  const [loading, setLoading] = useState(!cachedSeries);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadSeries() {
      try {
        if (!cachedSeries) {
          setLoading(true);
        }
        setError('');
        const response = await seriesService.getById(slug);
        if (!cancelled) {
          setSeries(response);
          setActiveSeason(0);
          writeSeriesCache(slug, response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load series details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSeries();

    return () => {
      cancelled = true;
    };
  }, [cachedSeries, slug]);

  if (loading && !series) {
    return <SeriesDetailsSkeleton />;
  }

  if (error || !series) {
    return <div style={styles.state}>{error || 'Series not found.'}</div>;
  }

  const seasons = Array.isArray(series.seasons) ? series.seasons : [];
  const currentSeason = seasons[activeSeason] || null;
  const firstSeason = seasons[0] || null;
  const firstEpisode = firstSeason?.episodes?.[0] || null;
  const firstSeasonNumber = toPositiveInt(firstSeason?.number ?? firstSeason?.id, 1);
  const firstEpisodeNumber = toPositiveInt(firstEpisode?.number ?? firstEpisode?.id, 1);
  const genres = Array.isArray(series.genres) && series.genres.length
    ? series.genres
    : String(series.genre || '').split(',').map((entry) => entry.trim()).filter(Boolean);

  return (
    <div style={styles.page}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : {}) }}>
        <div style={styles.backdrop}>
          <img src={series.backdrop || series.poster || posterFallback} alt={series.title} style={styles.bgImage} />
          <div style={styles.heroGradient} />
        </div>

        <div style={{ ...styles.heroContent, ...(isMobile ? styles.heroContentMobile : isTablet ? styles.heroContentTablet : {}) }}>
          <div style={{ ...styles.posterWrapper, ...(isMobile ? styles.posterWrapperMobile : {}) }}>
            <img src={series.poster || posterFallback} alt={series.title} style={styles.poster} />
          </div>

          <div style={{ ...styles.infoPanel, ...(isMobile ? styles.infoPanelMobile : {}) }}>
            <span style={styles.eyebrow}>Premium Series</span>
            <h1 style={styles.title}>{series.title}</h1>

            <div style={styles.meta}>
              <span style={styles.rating}>★ {series.rating || 'N/A'}</span>
              <span>{series.year}</span>
              <span>{seasons.length} Seasons</span>
              <span>{series.language || series.originalLanguage || 'Unknown'}</span>
            </div>

            <div style={styles.genres}>
              {genres.map((genre) => (
                <Link key={genre} to={`/browse?genre=${genre}`} style={styles.genreTag}>{genre}</Link>
              ))}
            </div>

            <p style={styles.description}>{series.description || 'Description not available yet.'}</p>

            <div style={styles.actions}>
              <Link to={`/watch/${series.id}?season=${firstSeasonNumber}&episode=${firstEpisodeNumber}`} style={styles.playBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>{`Play S${firstSeasonNumber}E${firstEpisodeNumber}`}</span>
              </Link>

              <Link to="/series" style={styles.secondaryBtn}>
                Browse More Series
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div style={styles.content}>
        <section style={{ ...styles.commandStrip, ...(isMobile ? styles.commandStripMobile : {}) }}>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Binge Setup</span>
            <strong style={styles.commandValue}>{seasons.length} seasons ready for browsing.</strong>
          </div>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Current Focus</span>
            <strong style={styles.commandValue}>{currentSeason?.title || `Season ${activeSeason + 1}`}</strong>
          </div>
          <div style={styles.commandCard}>
            <span style={styles.commandLabel}>Best Use</span>
            <strong style={styles.commandValue}>Great for long-form watching with quick episode jumps.</strong>
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <span style={styles.eyebrow}>Season Browser</span>
            <h2 style={styles.sectionTitle}>Choose a chapter</h2>
          </div>

          <div style={styles.seasonTabs}>
            {seasons.map((season, index) => (
              <button
                key={season.id || index}
                onClick={() => setActiveSeason(index)}
                style={{
                  ...styles.seasonTab,
                  ...(activeSeason === index ? styles.seasonTabActive : {}),
                }}
              >
                {season.title || `Season ${season.number || index + 1}`}
                <span style={styles.seasonYear}>{season.year || series.year || ''}</span>
              </button>
            ))}
          </div>

          {currentSeason ? (
            <div style={styles.episodeList}>
              <h3 style={styles.episodeHeader}>
                {currentSeason.title || `Season ${toPositiveInt(currentSeason.number ?? currentSeason.id, activeSeason + 1)}`} | {(currentSeason.episodes || []).length} Episodes
              </h3>
              {(currentSeason.episodes || []).map((episode, index) => (
                (() => {
                  const seasonParam = toPositiveInt(currentSeason.number ?? currentSeason.id, activeSeason + 1);
                  const episodeParam = toPositiveInt(episode?.number ?? episode?.id, index + 1);

                  return (
                <Link
                  key={episode.id || `${currentSeason.id || activeSeason}-${index + 1}`}
                  to={`/watch/${series.id}?season=${seasonParam}&episode=${episodeParam}`}
                  style={{ ...styles.episodeCard, ...(isMobile ? styles.episodeCardMobile : {}) }}
                >
                  <div style={styles.episodeNumber}>{episodeParam}</div>
                  <div style={styles.episodeInfo}>
                    <h4 style={styles.episodeTitle}>{episode.title || `Episode ${index + 1}`}</h4>
                    <p style={styles.episodeDescription}>{episode.description || 'Episode details are not available yet.'}</p>
                    <span style={styles.duration}>{episode.duration || 'Runtime unavailable'}</span>
                  </div>
                  <div style={styles.episodePlay}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </Link>
                  );
                })()
              ))}
            </div>
          ) : (
            <div style={styles.episodeList}>
              <h3 style={styles.episodeHeader}>Episodes are not available for this title yet.</h3>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SeriesDetailsSkeleton() {
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
            <div style={{ ...styles.skeletonLine, width: '52%', height: '56px', marginBottom: '16px' }} />
            <div style={{ ...styles.skeletonLine, width: '80%', height: '18px', marginBottom: '12px' }} />
            <div style={styles.skeletonChipRow}>
              <div style={{ ...styles.skeletonPill, width: '98px' }} />
              <div style={{ ...styles.skeletonPill, width: '108px' }} />
              <div style={{ ...styles.skeletonPill, width: '86px' }} />
            </div>
            <div style={{ ...styles.skeletonLine, width: '100%', height: '16px', marginBottom: '10px' }} />
            <div style={{ ...styles.skeletonLine, width: '90%', height: '16px', marginBottom: '10px' }} />
            <div style={{ ...styles.skeletonLine, width: '72%', height: '16px', marginBottom: '26px' }} />
            <div style={styles.skeletonActionRow}>
              <div style={{ ...styles.skeletonPill, width: '150px', height: '52px' }} />
              <div style={{ ...styles.skeletonPill, width: '180px', height: '52px' }} />
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
    minHeight: '78vh',
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
    background: 'linear-gradient(120deg, rgba(7,17,31,0.94) 18%, rgba(7,17,31,0.44) 56%, rgba(7,17,31,0.88) 100%)',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: '78vh',
    padding: 'var(--spacing-3xl) var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
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
  sectionCard: {
    padding: '26px',
    borderRadius: '28px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  sectionHeader: {
    display: 'grid',
    gap: '8px',
    marginBottom: '20px',
  },
  sectionTitle: {
    color: 'var(--text-primary)',
    fontSize: '1.3rem',
  },
  seasonTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '22px',
  },
  seasonTab: {
    padding: '14px 18px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    display: 'grid',
    gap: '6px',
  },
  seasonTabActive: {
    background: 'rgba(34,211,238,0.16)',
    color: 'var(--text-primary)',
    borderColor: 'rgba(34,211,238,0.35)',
  },
  seasonYear: {
    fontSize: '0.74rem',
    color: 'var(--text-muted)',
  },
  episodeList: {
    display: 'grid',
    gap: '14px',
  },
  episodeHeader: {
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  episodeCard: {
    display: 'grid',
    gridTemplateColumns: '56px minmax(0, 1fr) 44px',
    gap: '16px',
    alignItems: 'center',
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  episodeCardMobile: {
    gridTemplateColumns: '1fr',
    justifyItems: 'start',
  },
  episodeNumber: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: '700',
  },
  episodeInfo: {
    display: 'grid',
    gap: '8px',
    color: 'var(--text-secondary)',
  },
  episodeTitle: {
    color: 'var(--text-primary)',
  },
  episodeDescription: {
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
  },
  duration: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  episodePlay: {
    color: 'var(--accent-cyan)',
    display: 'grid',
    placeItems: 'center',
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
    minHeight: '420px',
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

export default SeriesDetailsPage;
