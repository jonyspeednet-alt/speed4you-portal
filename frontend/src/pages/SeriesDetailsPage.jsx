import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { seriesService } from '../services/seriesService';
import { useBreakpoint } from '../hooks';
import { useRecentlyViewed } from '../hooks';
import WatchlistButton from '../components/ui/WatchlistButton';
import ShareButton from '../components/ui/ShareButton';
import StarRating from '../components/ui/StarRating';

const posterFallback = '/portal/assets/poster-placeholder.svg';
const SERIES_CACHE_PREFIX = 'portal-series-details-v1:';

function toPositiveInt(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const m = String(value || '').match(/(\d+)/);
  if (m) { const p = Number(m[1]); if (Number.isFinite(p) && p > 0) return Math.floor(p); }
  return fallback;
}

function readCache(slug) {
  if (typeof sessionStorage === 'undefined' || !slug) return null;
  try { const r = sessionStorage.getItem(`${SERIES_CACHE_PREFIX}${slug}`); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function writeCache(slug, data) {
  if (typeof sessionStorage === 'undefined' || !slug || !data) return;
  try { sessionStorage.setItem(`${SERIES_CACHE_PREFIX}${slug}`, JSON.stringify(data)); } catch { /* ignore */ }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SeriesDetailsSkeleton() {
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
              {[150, 52].map((w, i) => (
                <div key={i} style={{ ...s.skeletonLine, width: w, height: 50, borderRadius: 999 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Episode card ──────────────────────────────────────────────────────────────
function EpisodeCard({ episode, index, seriesId, seasonParam, episodeParam, isMobile }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={`/watch/${seriesId}?season=${seasonParam}&episode=${episodeParam}`}
      style={{
        ...s.episodeCard,
        ...(isMobile ? s.episodeCardMobile : {}),
        ...(hovered ? s.episodeCardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Episode number badge */}
      <div style={{ ...s.epNumBadge, ...(isMobile ? s.epNumBadgeMobile : {}) }}>
        <span style={s.epNum}>{episodeParam}</span>
      </div>

      {/* Info */}
      <div style={s.epInfo}>
        <div style={s.epTitleRow}>
          <h4 style={s.epTitle}>{episode.title || `Episode ${index + 1}`}</h4>
          {episode.duration && <span style={s.epDuration}>{episode.duration}</span>}
        </div>
        {episode.description && (
          <p style={s.epDesc}>{episode.description}</p>
        )}
      </div>

      {/* Play icon */}
      <div style={{ ...s.epPlay, ...(hovered ? s.epPlayHover : {}) }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SeriesDetailsPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const { slug } = useParams();
  const { addItem: trackView } = useRecentlyViewed();
  const [series, setSeries] = useState(() => readCache(slug));
  const [loading, setLoading] = useState(() => !readCache(slug));
  const [error, setError] = useState('');
  const [activeSeason, setActiveSeason] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);
  const activeTabRef = useRef(null);
  const seasonTabsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cached = readCache(slug);
        if (!cached) setLoading(true);
        setError('');
        const res = await seriesService.getById(slug);
        if (!cancelled) {
          setSeries(res);
          setActiveSeason(0);
          writeCache(slug, res);
          trackView({ id: res.id, title: res.title, poster: res.poster, type: 'series', year: res.year, genre: res.genre });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load series details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug, trackView]);

  // Scroll active season tab into view
  useEffect(() => {
    if (activeTabRef.current && seasonTabsRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSeason]);

  if (loading && !series) return <SeriesDetailsSkeleton />;
  if (error || !series) {
    return (
      <div style={s.errorState}>
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>{error || 'Series not found.'}</p>
        <Link to="/series" style={s.backLink}>← Browse series</Link>
      </div>
    );
  }

  const seasons = Array.isArray(series.seasons) ? series.seasons : [];
  const currentSeason = seasons[activeSeason] || null;
  const firstSeason = seasons[0] || null;
  const firstEpisode = firstSeason?.episodes?.[0] || null;
  const firstSeasonNum = toPositiveInt(firstSeason?.number ?? firstSeason?.id, 1);
  const firstEpNum = toPositiveInt(firstEpisode?.number ?? firstEpisode?.id, 1);
  const genres = Array.isArray(series.genres) && series.genres.length
    ? series.genres
    : String(series.genre || '').split(',').map((g) => g.trim()).filter(Boolean);
  const totalEpisodes = seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0);
  const descLong = (series.description || '').length > 180;

  return (
    <div style={s.page}>
      <div style={{ ...s.auroraOrb, top: '-5%', left: '-10%', background: 'radial-gradient(circle, var(--accent-cyan), transparent 70%)' }} />
      <div style={{ ...s.auroraOrb, bottom: '30%', right: '-10%', background: 'radial-gradient(circle, var(--accent-pink), transparent 70%)' }} />

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.backdropWrap}>
          <img
            src={backdropError ? posterFallback : (series.backdrop || series.poster || posterFallback)}
            alt=""
            style={s.backdropImg}
            onError={() => setBackdropError(true)}
          />
          <div style={s.backdropOverlay} />
          <div style={s.heroGradient} />
        </div>

        <div style={{ ...s.heroInner, ...(isMobile ? s.heroInnerMobile : isTablet ? s.heroInnerTablet : {}) }}>

          {/* Poster */}
          <div style={{ ...s.posterWrap, ...(isMobile ? s.posterWrapMobile : {}) }}>
            <img
              src={posterError ? posterFallback : (series.poster || posterFallback)}
              alt={series.title}
              style={s.poster}
              onError={() => setPosterError(true)}
            />
            <div style={s.posterGlow} />
          </div>

          {/* Info */}
          <div style={{ ...s.infoPanel, ...(isMobile ? s.infoPanelMobile : {}) }}>
            <div style={s.eyebrowRow}>
              <span style={s.eyebrow}>Original Series</span>
              <span style={s.seasonsBadge}>{seasons.length} Season{seasons.length !== 1 ? 's' : ''}</span>
            </div>

            <h1 style={{ ...s.title, ...(isMobile ? s.titleMobile : {}) }}>{series.title}</h1>

            {/* Meta */}
            <div style={s.metaRow}>
              <div style={s.ratingBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-cyan)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                <span style={s.ratingVal}>{series.rating || 'N/A'}</span>
              </div>
              {series.year && <span style={s.metaChip}>{series.year}</span>}
              {totalEpisodes > 0 && <span style={s.metaChip}>{totalEpisodes} Episodes</span>}
              {(series.language || series.originalLanguage) && (
                <span style={s.metaChip}>{series.language || series.originalLanguage}</span>
              )}
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
                {series.description || 'No description available.'}
              </p>
              {isMobile && descLong && (
                <button style={s.readMore} onClick={() => setDescExpanded((v) => !v)} aria-expanded={descExpanded}>
                  {descExpanded ? 'Show less ↑' : 'Read more ↓'}
                </button>
              )}
            </div>

            {/* Actions */}
            <div style={{ ...s.actions, ...(isMobile ? s.actionsMobile : {}) }}>
              <Link
                to={`/watch/${series.id}?season=${firstSeasonNum}&episode=${firstEpNum}`}
                style={{ ...s.playBtn, ...(isMobile ? s.btnFull : {}) }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Now
              </Link>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <WatchlistButton contentType="series" contentId={series.id} title={series.title} />
                <ShareButton title={series.title} url={`${window.location.origin}/series/${series.id}`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Season & Episodes ── */}
      <div style={s.body}>

        {/* Season tabs */}
        {seasons.length > 1 && (
          <div style={s.seasonTabsWrap} ref={seasonTabsRef}>
            <div style={s.seasonTabs}>
              {seasons.map((season, idx) => {
                const active = activeSeason === idx;
                const label = season.title || `Season ${toPositiveInt(season.number ?? season.id, idx + 1)}`;
                const epCount = season.episodes?.length || 0;
                return (
                  <button
                    key={season.id || idx}
                    ref={active ? activeTabRef : null}
                    style={{ ...s.seasonTab, ...(active ? s.seasonTabActive : {}) }}
                    onClick={() => setActiveSeason(idx)}
                    aria-pressed={active}
                  >
                    <span style={s.seasonTabLabel}>{label}</span>
                    {epCount > 0 && (
                      <span style={{ ...s.seasonTabCount, ...(active ? s.seasonTabCountActive : {}) }}>
                        {epCount} ep
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Episode list */}
        {currentSeason ? (
          <section style={s.episodeSection}>
            <div style={s.episodeSectionHeader}>
              <div>
                <h2 style={s.episodeSectionTitle}>
                  {currentSeason.title || `Season ${toPositiveInt(currentSeason.number ?? currentSeason.id, activeSeason + 1)}`}
                </h2>
                <p style={s.episodeSectionMeta}>
                  {(currentSeason.episodes || []).length} episodes
                  {currentSeason.year ? ` · ${currentSeason.year}` : ''}
                </p>
              </div>
            </div>

            <div style={s.episodeList}>
              {(currentSeason.episodes || []).length === 0 ? (
                <div style={s.emptyEpisodes}>No episodes available for this season.</div>
              ) : (
                (currentSeason.episodes || []).map((episode, idx) => {
                  const seasonParam = toPositiveInt(currentSeason.number ?? currentSeason.id, activeSeason + 1);
                  const episodeParam = toPositiveInt(episode?.number ?? episode?.id, idx + 1);
                  return (
                    <EpisodeCard
                      key={episode.id || `${currentSeason.id || activeSeason}-${idx}`}
                      episode={episode}
                      index={idx}
                      seriesId={series.id}
                      seasonParam={seasonParam}
                      episodeParam={episodeParam}
                      isMobile={isMobile}
                    />
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <div style={s.emptyEpisodes}>No episodes available yet.</div>
        )}

        {/* Browse more */}
        <div style={s.browseMore}>
          {genres[0] && (
            <Link to={`/browse?genre=${genres[0]}`} style={s.browseBtn}>More {genres[0]} →</Link>
          )}
          <Link to="/series" style={s.browseBtn}>Browse all series →</Link>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', paddingTop: 88, position: 'relative', overflow: 'hidden' },

  auroraOrb: {
    position: 'absolute',
    width: '60vw',
    height: '60vw',
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.1,
    zIndex: 0,
    pointerEvents: 'none',
  },

  // Hero
  hero: {
    position: 'relative',
    minHeight: '75vh',
    display: 'flex',
    alignItems: 'center',
    padding: '40px 0',
  },
  backdropWrap: { position: 'absolute', inset: 0, zIndex: 0 },
  backdropImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center 10%',
  },
  backdropOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(105deg, rgba(5,12,22,0.95) 10%, rgba(5,12,22,0.4) 40%, rgba(5,12,22,0.2) 60%, rgba(5,12,22,0.9) 100%)',
  },
  heroGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to top, #050c16 0%, transparent 40%)',
  },
  heroInner: {
    position: 'relative',
    zIndex: 2,
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '60px',
    alignItems: 'center',
  },
  heroInnerTablet: {
    gridTemplateColumns: '260px 1fr',
    gap: '32px',
  },
  heroInnerMobile: {
    gridTemplateColumns: '1fr',
    gap: '24px',
    padding: '20px 16px',
    alignItems: 'start',
  },

  posterWrap: {
    position: 'relative',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
    border: '1px solid rgba(255,255,255,0.12)',
    aspectRatio: '2/3',
  },
  posterGlow: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), transparent 40%)',
    pointerEvents: 'none',
  },
  poster: { width: '100%', height: '100%', objectFit: 'cover' },

  infoPanel: { display: 'flex', flexDirection: 'column', gap: '20px' },
  eyebrow: {
    color: 'var(--accent-pink)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontSize: '0.75rem',
    fontWeight: '900',
  },
  seasonsBadge: {
    padding: '6px 12px',
    borderRadius: '8px',
    background: 'rgba(0, 255, 255, 0.1)',
    border: '1px solid rgba(0, 255, 255, 0.3)',
    color: 'var(--accent-cyan)',
    fontSize: '0.75rem',
    fontWeight: '900',
    letterSpacing: '0.05em',
  },

  title: {
    fontSize: 'clamp(2.8rem, 6vw, 5.2rem)',
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: '0.95',
    letterSpacing: '-0.03em',
    textShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  ratingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(0, 255, 255, 0.1)',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 255, 255, 0.3)',
  },
  ratingVal: {
    color: 'var(--accent-cyan)',
    fontWeight: '900',
    fontSize: '1rem',
  },
  metaChip: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '700',
    fontSize: '0.9rem',
    letterSpacing: '0.05em',
  },
  genreTag: {
    padding: '8px 16px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    fontSize: '0.8rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  playBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '18px 40px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-secondary))',
    color: '#050c16',
    fontWeight: '900',
    fontSize: '1.05rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
  },
  seasonTabActive: {
    background: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'var(--accent-cyan)',
    color: '#ffffff',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
  },
  seasonTabCountActive: { color: 'var(--accent-cyan)' },
  episodeCardHover: {
    background: 'rgba(13, 26, 45, 0.6)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
  epPlayHover: {
    background: 'var(--accent-cyan)',
    borderColor: 'var(--accent-cyan)',
    color: '#050c16',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.4)',
  },
  browseBtn: {
    padding: '12px 24px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};
