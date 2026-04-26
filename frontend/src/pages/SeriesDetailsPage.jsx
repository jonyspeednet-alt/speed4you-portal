import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { seriesService } from '../services/seriesService';
import { useBreakpoint } from '../hooks';
import { useRecentlyViewed } from '../hooks';
import WatchlistButton from '../components/ui/WatchlistButton';
import StarRating from '../components/ui/StarRating';

const posterFallback = 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400';
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

      {/* ── Hero ── */}
      <section style={s.hero}>
        <div style={s.backdropWrap}>
          <img
            src={backdropError ? posterFallback : (series.backdrop || series.poster || posterFallback)}
            alt=""
            style={s.backdropImg}
            onError={() => setBackdropError(true)}
          />
          <div style={s.backdropBlur} />
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
          </div>

          {/* Info */}
          <div style={{ ...s.infoPanel, ...(isMobile ? s.infoPanelMobile : {}) }}>
            <div style={s.eyebrowRow}>
              <span style={s.eyebrow}>Premium Series</span>
              <span style={s.seasonsBadge}>{seasons.length} Season{seasons.length !== 1 ? 's' : ''}</span>
            </div>

            <h1 style={{ ...s.title, ...(isMobile ? s.titleMobile : {}) }}>{series.title}</h1>

            {/* Meta */}
            <div style={s.metaRow}>
              <StarRating rating={series.rating} size="sm" showNumber />
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play S{firstSeasonNum}E{firstEpNum}
              </Link>
              <WatchlistButton contentType="series" contentId={series.id} title={series.title} />
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
  backdropWrap: { position: 'absolute', inset: 0 },
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

  posterWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    aspectRatio: '2/3',
  },
  posterWrapMobile: { maxWidth: 160, margin: '0 auto' },
  poster: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  infoPanel: { display: 'flex', flexDirection: 'column', gap: 16 },
  infoPanelMobile: { gap: 14 },

  eyebrowRow: { display: 'flex', alignItems: 'center', gap: 10 },
  eyebrow: {
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  seasonsBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    background: 'rgba(125,249,255,0.12)',
    border: '1px solid rgba(125,249,255,0.25)',
    color: 'var(--accent-cyan)',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
  },

  title: {
    fontSize: 'clamp(2rem, 4.5vw, 4.2rem)',
    color: 'var(--text-primary)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
  },
  titleMobile: { fontSize: 'clamp(1.6rem, 7vw, 2.4rem)' },

  metaRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaChip: {
    padding: '5px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },

  genreRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
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
  },

  descWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
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

  actions: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingTop: 4 },
  actionsMobile: { flexDirection: 'column', alignItems: 'stretch' },
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
  },
  btnFull: { width: '100%' },

  // Body
  body: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '32px var(--spacing-lg) var(--spacing-3xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  // Season tabs
  seasonTabsWrap: {
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    paddingBottom: 4,
  },
  seasonTabs: {
    display: 'flex',
    gap: 10,
    width: 'max-content',
    minWidth: '100%',
  },
  seasonTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '12px 18px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    flexShrink: 0,
    transition: 'all 150ms ease',
    minHeight: 'unset',
  },
  seasonTabActive: {
    background: 'rgba(255,90,95,0.12)',
    borderColor: 'rgba(255,90,95,0.3)',
    color: 'var(--text-primary)',
  },
  seasonTabLabel: { fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.2 },
  seasonTabCount: {
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  seasonTabCountActive: { color: 'var(--accent-red)' },

  // Episode section
  episodeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  episodeSectionHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  episodeSectionTitle: {
    color: 'var(--text-primary)',
    fontSize: '1.3rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  episodeSectionMeta: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    marginTop: 4,
  },

  episodeList: { display: 'flex', flexDirection: 'column', gap: 8 },

  // Episode card
  episodeCard: {
    display: 'grid',
    gridTemplateColumns: '52px minmax(0,1fr) 40px',
    gap: 16,
    alignItems: 'center',
    padding: '16px 18px',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    transition: 'all 150ms ease',
    textDecoration: 'none',
  },
  episodeCardMobile: {
    gridTemplateColumns: '40px minmax(0,1fr) 32px',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
  },
  episodeCardHover: {
    background: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,90,95,0.25)',
    transform: 'translateY(-1px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  },

  epNumBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  epNumBadgeMobile: { width: 40, height: 40, borderRadius: 10 },
  epNum: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: 800,
    fontFamily: 'var(--font-family-ui)',
  },

  epInfo: { display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden' },
  epTitleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  epTitle: {
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    fontWeight: 700,
    lineHeight: 1.3,
    fontFamily: 'var(--font-family-ui)',
  },
  epDuration: {
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  epDesc: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    lineHeight: 1.6,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  epPlay: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-muted)',
    flexShrink: 0,
    transition: 'all 150ms ease',
  },
  epPlayHover: {
    background: 'rgba(255,90,95,0.18)',
    borderColor: 'rgba(255,90,95,0.35)',
    color: 'var(--accent-red)',
  },

  emptyEpisodes: {
    padding: '32px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    borderRadius: 16,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
  },

  browseMore: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  browseBtn: {
    padding: '10px 18px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 700,
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
