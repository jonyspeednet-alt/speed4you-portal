import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroBanner from '../features/home/components/HeroBanner';
import ContentRail from '../features/home/components/ContentRail';
import { contentService, progressService } from '../services';
import { useBreakpoint, useRecentlyViewed } from '../hooks';

const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';
const RAIL_SIZE = 8;
const HOMEPAGE_POOL_LIMIT = 30;
const HOMEPAGE_CACHE_KEY = 'portal-homepage-cache-v1';
const HOMEPAGE_COMPACT_THRESHOLD = 4;

const fallbackContent = {
  featured: null,
  continueWatching: [],
  trending: [],
  popular: [],
  latest: [],
  movies: [],
  series: [],
  bengali: [],
};

function normalizeItem(item) {
  return {
    ...item,
    poster: item.poster || posterFallback,
    backdrop: item.backdrop || item.poster || posterFallback,
    genre: item.genre || 'Featured',
    description: item.description || 'Freshly published on the portal.',
    year: item.year || 'Unknown',
    rating: item.rating || 'N/A',
    type: item.type || 'movie',
    language: item.language || item.originalLanguage || 'Mixed',
  };
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = String(item?.id || '');
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function createRotationSeed(namespace) {
  const now = new Date();
  const rotationSlot = Math.floor(now.getHours() / 6);
  return `${namespace}-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${rotationSlot}`;
}

function hashSeed(value) {
  return Array.from(String(value || '')).reduce((accumulator, char) => (
    (accumulator * 31 + char.charCodeAt(0)) % 2147483647
  ), 7);
}

function rotateItems(items, seed, pinnedCount = 0) {
  const safeItems = uniqueById(items);
  if (safeItems.length <= pinnedCount + 1) {
    return safeItems;
  }

  const pinned = safeItems.slice(0, pinnedCount);
  const rotating = safeItems.slice(pinnedCount);
  const offset = hashSeed(seed) % rotating.length;

  return [...pinned, ...rotating.slice(offset), ...rotating.slice(0, offset)];
}

function buildRail(items, { seed, size = RAIL_SIZE, excludeIds = [], pinnedCount = 0 } = {}) {
  const blocked = new Set((excludeIds || []).map((id) => String(id)));
  const rotatedItems = rotateItems(items, seed, pinnedCount);
  const selected = [];

  rotatedItems.forEach((item) => {
    const key = String(item?.id || '');
    if (!key || blocked.has(key) || selected.length >= size) {
      return;
    }

    blocked.add(key);
    selected.push(item);
  });

  return selected;
}

function mergePools(...collections) {
  return uniqueById(collections.flat().filter(Boolean));
}

function pickFeatured(explicitFeatured, latestItems, popularItems, trendingItems) {
  const featuredCandidate = explicitFeatured && explicitFeatured.id ? normalizeItem(explicitFeatured) : null;
  if (featuredCandidate?.id) {
    return featuredCandidate;
  }

  const featuredPool = rotateItems(
    mergePools(latestItems.slice(0, 10), trendingItems.slice(0, 10), popularItems.slice(0, 10)),
    createRotationSeed('featured'),
    1,
  );
  const enrichedCandidate = featuredPool.find((item) => item.poster || item.backdrop || item.description);
  if (enrichedCandidate) {
    return enrichedCandidate;
  }

  if (popularItems[0]) {
    return popularItems[0];
  }

  return null;
}

function buildHomepageContent({ featured, latest, popular, trending, series, continueWatching }) {
  const latestItems = Array.isArray(latest) ? latest.map(normalizeItem) : [];
  const popularItems = Array.isArray(popular) ? popular.map(normalizeItem) : [];
  const trendingItems = Array.isArray(trending) ? trending.map(normalizeItem) : [];
  const homepageSeriesItems = Array.isArray(series) ? series.map(normalizeItem) : [];
  const moviePool = mergePools(
    latestItems.filter((item) => item.type !== 'series'),
    trendingItems.filter((item) => item.type !== 'series'),
    popularItems.filter((item) => item.type !== 'series'),
  );
  const seriesPool = mergePools(
    homepageSeriesItems,
    latestItems.filter((item) => item.type === 'series'),
    trendingItems.filter((item) => item.type === 'series'),
    popularItems.filter((item) => item.type === 'series'),
  );
  const bengaliPool = mergePools(
    latestItems.filter((item) => item.language === 'Bengali'),
    trendingItems.filter((item) => item.language === 'Bengali'),
    popularItems.filter((item) => item.language === 'Bengali'),
  );
  const continueWatchingItems = Array.isArray(continueWatching) ? continueWatching : [];
  const normalizedContinueWatching = continueWatchingItems.map(normalizeItem).slice(0, 5);
  const continueIds = normalizedContinueWatching.map((item) => item.id);
  const featuredItem = pickFeatured(featured, latestItems, popularItems, trendingItems);
  const featuredId = featuredItem?.id ? [featuredItem.id] : [];
  const latestRail = buildRail(latestItems, {
    seed: createRotationSeed('latest-rail'),
    size: RAIL_SIZE,
    excludeIds: continueIds,
    pinnedCount: 3,
  });
  const latestIds = latestRail.map((item) => item.id);
  const trendingRail = buildRail(trendingItems, {
    seed: createRotationSeed('trending-rail'),
    size: RAIL_SIZE,
    excludeIds: [...continueIds, ...featuredId, ...latestIds.slice(0, 4)],
    pinnedCount: 2,
  });
  const trendingIds = trendingRail.map((item) => item.id);
  const popularRail = buildRail(popularItems, {
    seed: createRotationSeed('popular-rail'),
    size: RAIL_SIZE,
    excludeIds: [...continueIds, ...featuredId, ...latestIds, ...trendingIds.slice(0, 4)],
    pinnedCount: 1,
  });
  const moviesRail = buildRail(moviePool, {
    seed: createRotationSeed('movies-rail'),
    size: RAIL_SIZE,
    excludeIds: [...continueIds, ...featuredId],
    pinnedCount: 2,
  });
  const seriesRail = buildRail(seriesPool, {
    seed: createRotationSeed('series-rail'),
    size: RAIL_SIZE,
    excludeIds: [...continueIds, ...featuredId],
    pinnedCount: 2,
  });
  const bengaliRail = buildRail(bengaliPool, {
    seed: createRotationSeed('bengali-rail'),
    size: RAIL_SIZE,
    excludeIds: [...continueIds, ...featuredId],
    pinnedCount: 2,
  });

  return {
    featured: featuredItem,
    trending: trendingRail,
    latest: latestRail,
    popular: popularRail,
    continueWatching: normalizedContinueWatching,
    movies: moviesRail,
    series: seriesRail,
    bengali: bengaliRail,
  };
}

function readHomepageCache() {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(HOMEPAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeHomepageCache(value) {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

function HomePage() {
  const { isMobile, isTablet } = useBreakpoint();
  const { items: recentlyViewed } = useRecentlyViewed();
  const [content, setContent] = useState(() => readHomepageCache()?.content || fallbackContent);
  const [loading, setLoading] = useState(() => !readHomepageCache());
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomepageData() {
      try {
        const cachedHomepage = readHomepageCache();
        if (!cachedHomepage) {
          setLoading(true);
        }

        const [homepageResponse, continueWatchingResponse] = await Promise.all([
          contentService.getHomepage(HOMEPAGE_POOL_LIMIT).catch(() => ({
            featured: null,
            latest: [],
            popular: [],
            trending: [],
            series: [],
          })),
          progressService.getContinueWatching().catch(() => ({ items: [] })),
        ]);
        const nextContent = buildHomepageContent({
          featured: homepageResponse?.featured,
          latest: homepageResponse?.latest,
          popular: homepageResponse?.popular,
          trending: homepageResponse?.trending,
          series: homepageResponse?.series,
          continueWatching: continueWatchingResponse?.items,
        });

        if (!cancelled) {
          setContent(nextContent);
          writeHomepageCache({
            content: nextContent,
            generatedAt: homepageResponse?.generatedAt || new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled) {
          setContent(fallbackContent);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchHomepageData();

    return () => {
      cancelled = true;
    };
  }, []);

  const spotlightCards = [
    {
      label: 'Jump Back In',
      value: content.continueWatching.length ? `${content.continueWatching.length} active titles` : 'Fresh start ready',
      action: '/watchlist',
    },
    {
      label: 'Discover Movies',
      value: content.movies.length ? `${content.movies.length} fresh picks` : 'Open movie shelf',
      action: '/movies',
    },
    {
      label: 'Start A Series',
      value: content.series.length ? `${content.series.length} binge options` : 'Open series shelf',
      action: '/series',
    },
  ];

  const mergedCatalogItems = mergePools(
    content.latest,
    content.trending,
    content.popular,
    content.movies,
    content.series,
    content.bengali,
  );
  const compactHomepage = mergedCatalogItems.length <= HOMEPAGE_COMPACT_THRESHOLD;
  const hasDistinctMovieShelf = content.movies.some((item) => item.type !== 'series');
  const showTrendingRail = !compactHomepage && content.trending.length >= 3;
  const showPopularRail = !compactHomepage && content.popular.length >= 3;
  const showLatestRail = content.latest.length >= 1;
  const showMoviesRail = !compactHomepage && hasDistinctMovieShelf && content.movies.length >= 3;
  const showSeriesRail = content.series.length >= 1;
  const showBengaliRail = !compactHomepage && content.bengali.length >= 2;

  return (
    <div style={styles.page}>
      {loading && !content.featured ? (
        <div style={styles.heroSkeleton} aria-hidden="true">
          <div style={styles.heroSkeletonShimmer} />
        </div>
      ) : content.featured ? (
        <HeroBanner content={content.featured} />
      ) : null}

      <div style={styles.content}>
        <section style={{ ...styles.commandDeck, ...(isMobile ? styles.commandDeckMobile : isTablet ? styles.commandDeckTablet : {}) }}>
          <div style={styles.commandIntro}>
            <span style={styles.sectionEyebrow}>Portal Overview</span>
            <h2 style={styles.commandTitle}>Cleaner shelves and a steadier homepage rhythm.</h2>
            <p style={styles.commandText}>
              The top fold now focuses on real catalog movement so visitors can jump into movies, series, or unfinished titles without hunting around the page.
            </p>
            <div style={styles.commandHighlights}>
              <span style={styles.highlightPill}>{content.trending.length || 0} trending now</span>
              <span style={styles.highlightPill}>{content.latest.length || 0} latest drops</span>
              <span style={styles.highlightPill}>{content.series.length || 0} series ready</span>
            </div>
            <span style={styles.rotationNote}>Shelves rotate through the day, but the structure stays stable and easier to scan.</span>
          </div>

          <div style={{ ...styles.commandGrid, ...(isMobile ? styles.commandGridMobile : isTablet ? styles.commandGridTablet : {}) }}>
            {spotlightCards.map((card) => (
              <Link
                key={card.label}
                to={card.action}
                style={{
                  ...styles.commandCard,
                  ...(hoveredCard === card.label ? styles.commandCardHover : {}),
                }}
                onMouseEnter={() => setHoveredCard(card.label)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <span style={styles.commandLabel}>{card.label}</span>
                <strong style={styles.commandValue}>{card.value}</strong>
                <span style={styles.commandAction}>Open →</span>
              </Link>
            ))}
          </div>
        </section>

        {loading && <div style={styles.loadingNotice}>Refreshing the showcase…</div>}

        {recentlyViewed.length > 0 && (
          <ContentRail
            title="Recently Viewed"
            subtitle="Pick up where you left off"
            items={recentlyViewed}
            viewAllLink="/watchlist"
          />
        )}

        {content.continueWatching.length > 0 && (
          <ContentRail
            title="Continue Watching"
            subtitle="Resume instantly"
            items={content.continueWatching}
            type="continue"
            viewAllLink="/watchlist"
          />
        )}

        {compactHomepage ? (
          <ContentRail
            title="Fresh on the Portal"
            subtitle="Current live catalog"
            items={mergedCatalogItems}
            viewAllLink="/browse?sort=latest"
            priorityCount={4}
          />
        ) : null}

        {showTrendingRail && (
          <ContentRail
            title="Trending Right Now"
            subtitle="Most watched this week"
            items={content.trending}
            type="popular"
            viewAllLink="/browse?sort=trending"
            priorityCount={4}
          />
        )}

        {showPopularRail && (
          <ContentRail
            title="Popular on ISP Portal"
            subtitle="Crowd favorites"
            items={content.popular}
            type="popular"
            viewAllLink="/browse?sort=popular"
            priorityCount={3}
          />
        )}

        {showLatestRail && (
          <ContentRail
            title="Latest Releases"
            subtitle="Just added"
            items={content.latest}
            viewAllLink="/browse?sort=latest"
            priorityCount={4}
          />
        )}

        {showMoviesRail && (
          <ContentRail
            title="Movies"
            subtitle="Lean-back movie night"
            items={content.movies}
            viewAllLink="/movies"
          />
        )}

        {showSeriesRail && (
          <ContentRail
            title="Series"
            subtitle="Binge-ready chapters"
            items={content.series}
            type="series"
            viewAllLink="/series"
          />
        )}

        {showBengaliRail && (
          <ContentRail
            title="Bengali Picks"
            subtitle="Local language highlights"
            items={content.bengali}
            viewAllLink="/browse?language=Bengali"
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
  },
  heroSkeleton: {
    position: 'relative',
    minHeight: '88vh',
    overflow: 'hidden',
    background: 'linear-gradient(135deg, #08111d 0%, #12233a 50%, #0a1322 100%)',
  },
  heroSkeletonShimmer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.8s infinite',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    paddingBottom: 'var(--spacing-3xl)',
  },
  commandDeck: {
    maxWidth: '1400px',
    margin: '-20px auto 20px auto',
    padding: '0 var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.95fr)',
    gap: '18px',
    alignItems: 'stretch',
  },
  commandDeckTablet: {
    gridTemplateColumns: '1fr',
  },
  commandDeckMobile: {
    margin: '8px auto 14px auto',
    padding: '0 var(--spacing-md)',
    gridTemplateColumns: '1fr',
  },
  commandIntro: {
    padding: '22px 24px',
    borderRadius: 'var(--radius-xl)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(14px)',
    boxShadow: 'var(--shadow-soft)',
  },
  sectionEyebrow: {
    display: 'inline-block',
    marginBottom: '10px',
    fontSize: '0.74rem',
    fontWeight: '700',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--accent-cyan)',
  },
  commandTitle: {
    maxWidth: '12ch',
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  commandText: {
    maxWidth: '48ch',
    lineHeight: '1.65',
    fontSize: '0.98rem',
  },
  commandHighlights: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '2px',
  },
  highlightPill: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  rotationNote: {
    display: 'inline-block',
    marginTop: '12px',
    color: 'var(--accent-amber)',
    fontSize: '0.78rem',
    fontWeight: '700',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  commandGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  commandGridTablet: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  commandGridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  commandCard: {
    minHeight: '100%',
    padding: '18px',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
    display: 'grid',
    gap: '8px',
    alignContent: 'space-between',
    transition: 'background 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
  },
  commandCardHover: {
    background: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(255,255,255,0.14)',
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
  },
  commandLabel: {
    display: 'block',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  commandValue: {
    color: 'var(--text-primary)',
    fontSize: '0.98rem',
    fontWeight: '800',
    lineHeight: '1.35',
  },
  commandAction: {
    color: 'var(--accent-amber)',
    fontWeight: '700',
    fontSize: '0.76rem',
  },
  loadingNotice: {
    maxWidth: '1400px',
    margin: '0 auto 12px auto',
    padding: '0 var(--spacing-lg)',
    color: 'var(--accent-amber)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
};

export default HomePage;
