import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroCarousel from '../features/home/components/HeroCarousel';
import ContentRail from '../features/home/components/ContentRail';
import TrendingBento from '../features/home/components/TrendingBento';
import QuickViewModal from '../components/ui/QuickViewModal';
import { contentService, progressService } from '../services';
import { useBreakpoint, useRecentlyViewed, useTVMode } from '../hooks';

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
    if (!key || seen.has(key)) return false;
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
  return Array.from(String(value || '')).reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) % 2147483647), 7);
}

function rotateItems(items, seed, pinnedCount = 0) {
  const safeItems = uniqueById(items);
  if (safeItems.length <= pinnedCount + 1) return safeItems;
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
    if (!key || blocked.has(key) || selected.length >= size) return;
    blocked.add(key);
    selected.push(item);
  });

  return selected;
}

function mergePools(...collections) {
  return uniqueById(collections.flat().filter(Boolean));
}

function pickFeatured(explicitFeatured, latestItems, popularItems, trendingItems) {
  const featuredSource = mergePools(
    latestItems,
    trendingItems,
    popularItems,
  );

  const featuredCandidate = explicitFeatured && explicitFeatured.id ? normalizeItem(explicitFeatured) : null;
  const rotatedPool = rotateItems(
    featuredSource.filter((item) => item.poster || item.backdrop || item.description),
    createRotationSeed('featured'),
    featuredCandidate?.id ? 1 : 0,
  );

  if (featuredCandidate?.id) {
    return [featuredCandidate, ...rotatedPool.filter((item) => String(item.id) !== String(featuredCandidate.id))];
  }

  return rotatedPool.length > 0 ? rotatedPool : popularItems[0] ? [popularItems[0]] : [];
}

function buildHomepageContent({ featured, latest, popular, trending, series, continueWatching, publishedCatalog }) {
  const latestItems = Array.isArray(latest) ? latest.map(normalizeItem) : [];
  const popularItems = Array.isArray(popular) ? popular.map(normalizeItem) : [];
  const trendingItems = Array.isArray(trending) ? trending.map(normalizeItem) : [];
  const homepageSeriesItems = Array.isArray(series) ? series.map(normalizeItem) : [];
  const publishedItems = Array.isArray(publishedCatalog) ? publishedCatalog.map(normalizeItem) : [];
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
  const continueWatchingItems = Array.isArray(continueWatching) ? continueWatching.map(normalizeItem).slice(0, 5) : [];
  const continueIds = continueWatchingItems.map((item) => item.id);
  const featuredPool = publishedItems.length > 0 ? publishedItems : mergePools(latestItems, trendingItems, popularItems, homepageSeriesItems);
  const featuredItems = pickFeatured(featured, featuredPool, [], []);
  const featuredIds = featuredItems.slice(0, 4).map((item) => item.id);
  const latestRail = buildRail(latestItems, { seed: createRotationSeed('latest'), size: RAIL_SIZE, excludeIds: continueIds, pinnedCount: 3 });
  const trendingRail = buildRail(trendingItems, { seed: createRotationSeed('trending'), size: RAIL_SIZE, excludeIds: [...continueIds, ...featuredIds], pinnedCount: 2 });
  const popularRail = buildRail(popularItems, { seed: createRotationSeed('popular'), size: RAIL_SIZE, excludeIds: [...continueIds, ...featuredIds], pinnedCount: 1 });
  const moviesRail = buildRail(moviePool, { seed: createRotationSeed('movies'), size: RAIL_SIZE, excludeIds: [...continueIds, ...featuredIds], pinnedCount: 2 });
  const seriesRail = buildRail(seriesPool, { seed: createRotationSeed('series'), size: RAIL_SIZE, excludeIds: [...continueIds, ...featuredIds], pinnedCount: 2 });
  const bengaliRail = buildRail(bengaliPool, { seed: createRotationSeed('bengali'), size: RAIL_SIZE, excludeIds: [...continueIds, ...featuredIds], pinnedCount: 2 });

  return {
    featured: featuredItems,
    trending: trendingRail,
    latest: latestRail,
    popular: popularRail,
    continueWatching: continueWatchingItems,
    movies: moviesRail,
    series: seriesRail,
    bengali: bengaliRail,
  };
}

function readHomepageCache() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(HOMEPAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeHomepageCache(value) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

async function fetchAllPublishedCatalog() {
  const limit = 100;
  let page = 1;
  let hasMore = true;
  const allItems = [];

  while (hasMore) {
    const response = await contentService.browse({ page, limit, sort: 'latest' }).catch(() => ({ items: [], hasMore: false }));
    allItems.push(...(response?.items || []));
    hasMore = Boolean(response?.hasMore);
    page += 1;

    if ((response?.items || []).length === 0) {
      hasMore = false;
    }
  }

  return uniqueById(allItems);
}

function HomePage() {
  const { isMobile } = useBreakpoint();
  const isTVMode = useTVMode();
  const { items: recentlyViewed } = useRecentlyViewed();
  const [content, setContent] = useState(() => readHomepageCache()?.content || fallbackContent);
  const [loading, setLoading] = useState(() => !readHomepageCache());
  const [quickViewItem, setQuickViewItem] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomepageData() {
      try {
        const [homepageResponse, continueWatchingResponse, publishedCatalog] = await Promise.all([
          contentService.getHomepage(HOMEPAGE_POOL_LIMIT).catch(() => ({ featured: null, latest: [], popular: [], trending: [], series: [] })),
          progressService.getContinueWatching().catch(() => ({ items: [] })),
          fetchAllPublishedCatalog(),
        ]);

        const nextContent = buildHomepageContent({
          featured: homepageResponse?.featured,
          latest: homepageResponse?.latest,
          popular: homepageResponse?.popular,
          trending: homepageResponse?.trending,
          series: homepageResponse?.series,
          continueWatching: continueWatchingResponse?.items,
          publishedCatalog,
        });

        if (!cancelled) {
          setContent(nextContent);
          writeHomepageCache({ content: nextContent, generatedAt: homepageResponse?.generatedAt || new Date().toISOString() });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHomepageData();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFeaturedHero = Array.isArray(content.featured) && content.featured.length > 0;

  return (
    <div style={{ ...styles.page, ...(!hasFeaturedHero ? styles.pageWithoutHero : {}) }}>
      {hasFeaturedHero ? <HeroCarousel items={content.featured} /> : null}

      <div style={{ 
        ...styles.content, 
        ...(isTVMode ? styles.contentTV : {}),
        ...(isMobile ? styles.contentMobile : {}) 
      }}>
        {loading ? <div style={styles.loadingNote}>Refreshing shelves...</div> : null}

        {recentlyViewed.length > 0 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Recently Viewed" subtitle="Jump back faster" items={recentlyViewed} viewAllLink="/watchlist" />
        ) : null}

        {content.trending.length >= 5 ? (
          <TrendingBento items={content.trending} onQuickView={setQuickViewItem} />
        ) : content.trending.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Trending Right Now" subtitle="Most watched this week" items={content.trending} viewAllLink="/browse?sort=trending" priorityCount={4} />
        ) : null}

        {content.continueWatching.length > 0 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Continue Watching" subtitle="Resume instantly" items={content.continueWatching} type="continue" viewAllLink="/watchlist" />
        ) : null}

        {content.popular.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Portal Favorites" subtitle="Strong local demand" items={content.popular} viewAllLink="/browse?sort=popular" priorityCount={3} />
        ) : null}

        {content.latest.length >= 1 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Latest Releases" subtitle="Just added" items={content.latest} viewAllLink="/browse?sort=latest" priorityCount={4} />
        ) : null}

        {content.movies.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Movies" subtitle="Lean-back movie night" items={content.movies} viewAllLink="/movies" />
        ) : null}

        {content.series.length >= 1 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Series" subtitle="Binge-ready stories" items={content.series} type="series" viewAllLink="/series" />
        ) : null}

        {content.bengali.length >= 2 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Bengali Picks" subtitle="Local language highlights" items={content.bengali} viewAllLink="/browse?language=Bengali" />
        ) : null}
      </div>

      <QuickViewModal isOpen={!!quickViewItem} item={quickViewItem} onClose={() => setQuickViewItem(null)} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
  },
  pageWithoutHero: {
    paddingTop: 'calc(var(--nav-occupied-desktop) + 14px)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    paddingBottom: 'var(--spacing-3xl)',
    display: 'grid',
    gap: '40px', /* Increased gap for better breathing space */
    marginTop: '-40px',
  },
  contentTV: {
    gap: '60px',
    paddingBottom: '120px',
  },
  contentMobile: {
    gap: '24px',
    marginTop: '-20px',
  },
  overview: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '24px auto 10px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 460px',
    gap: '20px',
    position: 'relative',
    zIndex: 2,
  },
  overviewTablet: {
    width: 'min(1440px, calc(100vw - 28px))',
    gridTemplateColumns: '1fr',
    marginTop: '16px',
  },
  overviewTV: {
    width: 'min(1720px, calc(100vw - 96px))',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(420px, 520px)',
    gap: '28px',
    marginTop: '32px',
  },
  overviewMobile: {
    width: 'min(1440px, calc(100vw - 24px))',
    gridTemplateColumns: '1fr',
    marginTop: '12px',
  },
  overviewWithoutHero: {
    margin: '0 auto 10px',
  },
  overviewWithoutHeroTablet: {
    marginTop: '0',
  },
  overviewWithoutHeroMobile: {
    marginTop: '0',
  },
  overviewCopy: {
    padding: '28px',
    borderRadius: '32px',
    background: 'rgba(8, 18, 33, 0.82)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  eyebrow: {
    display: 'inline-block',
    marginBottom: '10px',
    color: 'var(--accent-secondary)',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  overviewTitle: {
    maxWidth: '14ch',
    marginBottom: '12px',
    color: 'var(--text-primary)',
  },
  overviewTitleTV: {
    maxWidth: '15ch',
  },
  overviewText: {
    maxWidth: '56ch',
    fontSize: '0.98rem',
    lineHeight: '1.72',
  },
  overviewTextTV: {
    maxWidth: '62ch',
    fontSize: '1.08rem',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '22px',
  },
  metricRowMobile: {
    gridTemplateColumns: '1fr',
  },
  metricRowTV: {
    gap: '16px',
  },
  metricCard: {
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  metricLabel: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: 'var(--text-primary)',
    fontSize: '1.2rem',
  },
  spotlightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },
  spotlightGridMobile: {
    gridTemplateColumns: '1fr',
  },
  spotlightGridTV: {
    gap: '18px',
  },
  spotlightCard: {
    minHeight: '160px',
    padding: '20px',
    borderRadius: '28px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: 'var(--shadow-soft)',
    display: 'grid',
    alignContent: 'space-between',
    gap: '10px',
  },
  spotlightLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  spotlightValue: {
    color: 'var(--text-primary)',
    fontSize: '1.04rem',
    lineHeight: '1.4',
  },
  spotlightAction: {
    color: '#ffd8bd',
    fontSize: '0.78rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  loadingNote: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto 4px',
    color: 'var(--accent-cyan)',
    fontSize: '0.8rem',
    fontWeight: '900',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    textAlign: 'center',
    padding: '40px 0',
    opacity: 0.8,
  },
};

export default HomePage;
