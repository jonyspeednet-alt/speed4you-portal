import { useEffect, useState } from 'react';
import HeroCarousel from '../features/home/components/HeroCarousel';
import ContentRail from '../features/home/components/ContentRail';
import ContinueWatchingRail from '../features/continueWatching/components/ContinueWatchingRail';
import TrendingBento from '../features/home/components/TrendingBento';
import QuickViewModal from '../components/ui/QuickViewModal';
import { contentService, progressService } from '../services';
import { useBreakpoint, useRecentlyViewed, useTVMode } from '../hooks';

const posterFallback = '/portal/assets/poster-placeholder.svg';
const RAIL_SIZE = 10;
const HOMEPAGE_POOL_LIMIT = 40;
const HOMEPAGE_CACHE_KEY = 'portal-homepage-cache-v2'; // Cache key updated
const HOMEPAGE_COMPACT_THRESHOLD = 4;

// ... (rest of the helper functions remain the same) ...

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
  const rotationSlot = Math.floor(now.getHours() / 4); // Rotate more frequently
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
  const featuredSource = mergePools(latestItems, trendingItems, popularItems);
  const featuredCandidate = explicitFeatured && explicitFeatured.id ? normalizeItem(explicitFeatured) : null;
  const rotatedPool = rotateItems(
    featuredSource.filter(item => item.poster || item.backdrop || item.description),
    createRotationSeed('featured'),
    featuredCandidate?.id ? 1 : 0
  );

  if (featuredCandidate?.id) {
    return [featuredCandidate, ...rotatedPool.filter(item => String(item.id) !== String(featuredCandidate.id))];
  }

  return rotatedPool.length > 0 ? rotatedPool : (popularItems[0] ? [popularItems[0]] : []);
}


function buildHomepageContent({
  featured, latest, popular, trending, series, continueWatching,
  recommendations, localTrending, publishedCatalog
}) {
  const latestItems = (latest || []).map(normalizeItem);
  const popularItems = (popular || []).map(normalizeItem);
  const trendingItems = (trending || []).map(normalizeItem);
  const homepageSeriesItems = (series || []).map(normalizeItem);
  const publishedItems = (publishedCatalog || []).map(normalizeItem);
  const recommendationsItems = (recommendations || []).map(normalizeItem);
  const localTrendingItems = (localTrending || []).map(normalizeItem);

  const moviePool = mergePools(
    latestItems.filter(item => item.type !== 'series'),
    trendingItems.filter(item => item.type !== 'series'),
    popularItems.filter(item => item.type !== 'series'),
  );
  const seriesPool = mergePools(
    homepageSeriesItems,
    latestItems.filter(item => item.type === 'series'),
    trendingItems.filter(item => item.type === 'series'),
    popularItems.filter(item => item.type === 'series'),
  );
  const bengaliPool = mergePools(
    latestItems.filter(item => item.language === 'Bengali'),
    trendingItems.filter(item => item.language === 'Bengali'),
    popularItems.filter(item => item.language === 'Bengali'),
  );

  const continueWatchingItems = (continueWatching || []).map(item => {
    const normalized = normalizeItem(item);
    if (normalized.duration > 0 && normalized.last_position > 0) {
      normalized.progress = Math.min(99, (normalized.last_position / normalized.duration) * 100);
    } else {
      normalized.progress = 0;
    }
    return normalized;
  }).slice(0, 10);

  const continueIds = continueWatchingItems.map(item => item.id);

  const featuredPool = publishedItems.length > 0 ? publishedItems : mergePools(latestItems, trendingItems, popularItems, homepageSeriesItems);
  const featuredItems = pickFeatured(featured, featuredPool, [], []);
  const featuredIds = featuredItems.slice(0, 5).map(item => item.id);

  const excludeIds = [...continueIds, ...featuredIds];

  return {
    featured: featuredItems,
    continueWatching: continueWatchingItems,
    recommendations: buildRail(recommendationsItems, { seed: createRotationSeed('recommendations'), size: RAIL_SIZE, excludeIds }),
    localTrending: buildRail(localTrendingItems, { seed: createRotationSeed('local-trending'), size: RAIL_SIZE, excludeIds, pinnedCount: 2 }),
    trending: buildRail(trendingItems, { seed: createRotationSeed('trending'), size: RAIL_SIZE, excludeIds, pinnedCount: 3 }),
    latest: buildRail(latestItems, { seed: createRotationSeed('latest'), size: RAIL_SIZE, excludeIds, pinnedCount: 4 }),
    popular: buildRail(popularItems, { seed: createRotationSeed('popular'), size: RAIL_SIZE, excludeIds, pinnedCount: 2 }),
    movies: buildRail(moviePool, { seed: createRotationSeed('movies'), size: RAIL_SIZE, excludeIds, pinnedCount: 2 }),
    series: buildRail(seriesPool, { seed: createRotationSeed('series'), size: RAIL_SIZE, excludeIds, pinnedCount: 2 }),
    bengali: buildRail(bengaliPool, { seed: createRotationSeed('bengali'), size: RAIL_SIZE, excludeIds, pinnedCount: 2 }),
  };
}

function readHomepageCache() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(HOMEPAGE_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    // Basic cache validation
    if (Date.now() - new Date(cache.generatedAt).getTime() > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(HOMEPAGE_CACHE_KEY);
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function writeHomepageCache(value) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to write to homepage cache:', e);
  }
}

async function fetchAllPublishedCatalog() {
  const limit = 150;
  let page = 1;
  let hasMore = true;
  const allItems = [];

  while (hasMore) {
    const response = await contentService.browse({ page, limit, sort: 'latest' }).catch(() => ({ items: [], hasMore: false }));
    allItems.push(...(response?.items || []));
    hasMore = Boolean(response?.hasMore) && (response?.items?.length || 0) > 0;
    page += 1;
    if (page > 5) hasMore = false; // Safety break
  }

  return uniqueById(allItems);
}


function HomePage() {
  const { isMobile } = useBreakpoint();
  const isTVMode = useTVMode();
  const { items: recentlyViewed } = useRecentlyViewed();
  const [content, setContent] = useState(() => readHomepageCache()?.content || {});
  const [loading, setLoading] = useState(() => !readHomepageCache());
  const [quickViewItem, setQuickViewItem] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomepageData() {
      if (cancelled) return;
      setLoading(true);

      try {
        const continueWatchingResponse = await progressService.getContinueWatching().catch(() => ({ items: [] }));
        const seedContentId = continueWatchingResponse?.items?.[0]?.id || recentlyViewed?.[0]?.id || '';

        const [homepageResponse, recommendations, localTrending, publishedCatalog] = await Promise.all([
          contentService.getHomepage(HOMEPAGE_POOL_LIMIT).catch(() => ({})),
          seedContentId ? contentService.getRecommendations(seedContentId).catch(() => []) : Promise.resolve([]),
          contentService.getLocalTrending().catch(() => []),
          fetchAllPublishedCatalog(),
        ]);

        const nextContent = buildHomepageContent({
          ...homepageResponse,
          continueWatching: continueWatchingResponse?.items,
          recommendations,
          localTrending,
          publishedCatalog
        });

        if (!cancelled) {
          setContent(nextContent);
          writeHomepageCache({ content: nextContent, generatedAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Failed to fetch homepage data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHomepageData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFeaturedHero = Array.isArray(content.featured) && content.featured.length > 0;

  return (
    <div style={{ ...styles.page, ...(!hasFeaturedHero ? styles.pageWithoutHero : {}) }}>
      {hasFeaturedHero ? <HeroCarousel items={content.featured} onQuickView={setQuickViewItem} /> : null}

      <div style={{ ...styles.content, ...(isTVMode ? styles.contentTV : {}), ...(isMobile ? styles.contentMobile : {}) }}>
        {loading && Object.keys(content).length === 0 ? (
          <div style={styles.loadingNote}>Building your portal...</div>
        ) : null}

        <ContinueWatchingRail items={content.continueWatching} isLoading={loading && !content.continueWatching} />

        {content.recommendations?.length > 0 ? (
          <ContentRail
            onQuickView={setQuickViewItem}
            title="Because you watched..."
            subtitle="More of what you like"
            items={content.recommendations}
          />
        ) : null}

        {content.localTrending?.length > 3 ? (
          <ContentRail
            onQuickView={setQuickViewItem}
            title="Trending Near You"
            subtitle="Popular in your area"
            items={content.localTrending}
          />
        ) : null}

        {content.trending?.length >= 5 ? (
          <TrendingBento items={content.trending} onQuickView={setQuickViewItem} />
        ) : content.trending?.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Trending Right Now" subtitle="Most watched this week" items={content.trending} viewAllLink="/browse?sort=trending" priorityCount={4} />
        ) : null}

        {content.latest?.length >= 1 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Latest Releases" subtitle="Just added" items={content.latest} viewAllLink="/browse?sort=latest" priorityCount={4} />
        ) : null}

        {content.popular?.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Portal Favorites" subtitle="Strong local demand" items={content.popular} viewAllLink="/browse?sort=popular" priorityCount={3} />
        ) : null}

        {content.movies?.length >= 3 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Movies" subtitle="Lean-back movie night" items={content.movies} viewAllLink="/movies" />
        ) : null}

        {content.series?.length >= 1 ? (
          <ContentRail onQuickView={setQuickViewItem} title="Series" subtitle="Binge-ready stories" items={content.series} type="series" viewAllLink="/series" />
        ) : null}

        {content.bengali?.length >= 2 ? (
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
    paddingTop: 'calc(var(--nav-occupied-desktop) + 24px)',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    paddingBottom: 'var(--spacing-3xl)',
    display: 'grid',
    gap: 'var(--spacing-2xl)',
    marginTop: '-60px',
  },
  contentTV: {
    gap: '60px',
    paddingBottom: '120px',
  },
  contentMobile: {
    gap: 'var(--spacing-xl)',
    marginTop: '-30px',
  },
  loadingNote: {
    textAlign: 'center',
    padding: '80px 0',
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
};

export default HomePage;
