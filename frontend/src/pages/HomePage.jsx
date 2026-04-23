import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeroBanner from '../features/home/components/HeroBanner';
import ContentRail from '../features/home/components/ContentRail';
import { contentService, progressService } from '../services';
import { useBreakpoint } from '../hooks';

const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';
const RAIL_SIZE = 8;
const HOMEPAGE_POOL_LIMIT = 30;
const HOMEPAGE_CACHE_KEY = 'portal-homepage-cache-v1';

const fallbackContent = {
  featured: {
    id: 'portal-featured-placeholder',
    title: 'Fresh picks are loading',
    description: 'New movies and series will appear here as soon as the latest published titles are available from the portal catalog.',
    poster: '',
    backdrop: '',
    genre: 'Portal Spotlight',
    year: 'Tonight',
    type: 'movie',
    language: 'Mixed',
    rating: 'Updating',
    isPlaceholder: true,
  },
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

  return fallbackContent.featured;
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
  const cachedHomepage = readHomepageCache();
  const [content, setContent] = useState(cachedHomepage?.content || fallbackContent);
  const [loading, setLoading] = useState(!cachedHomepage);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomepageData() {
      try {
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
      } catch (err) {
        console.error('Failed to fetch homepage:', err);
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
  }, [cachedHomepage]);

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

  return (
    <div style={styles.page}>
      <HeroBanner content={content.featured} />

      <div style={styles.content}>
        <section style={{ ...styles.commandDeck, ...(isMobile ? styles.commandDeckMobile : isTablet ? styles.commandDeckTablet : {}) }}>
          <div style={styles.commandIntro}>
            <span style={styles.sectionEyebrow}>Portal Upgrade</span>
            <h2 style={styles.commandTitle}>Faster choices. Cleaner shelves. More watchable discovery.</h2>
            <p style={styles.commandText}>
              Quick actions and compact shelves now surface the titles people actually want without wasting vertical space.
            </p>
            <span style={styles.rotationNote}>Shelves refresh through the day so the homepage does not feel stuck on the same titles.</span>
          </div>

          <div style={{ ...styles.commandGrid, ...(isMobile ? styles.commandGridMobile : isTablet ? styles.commandGridTablet : {}) }}>
            {spotlightCards.map((card) => (
              <Link key={card.label} to={card.action} style={styles.commandCard}>
                <span style={styles.commandLabel}>{card.label}</span>
                <strong style={styles.commandValue}>{card.value}</strong>
                <span style={styles.commandAction}>Open</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ ...styles.quickBrowse, ...(isMobile ? styles.quickBrowseMobile : isTablet ? styles.quickBrowseTablet : {}) }}>
          <Link to="/browse?sort=trending" style={styles.quickBrowseCard}>
            <span style={styles.quickBrowseLabel}>Trending</span>
            <strong style={styles.quickBrowseValue}>{content.trending.length || 0} titles</strong>
          </Link>
          <Link to="/browse?sort=latest" style={styles.quickBrowseCard}>
            <span style={styles.quickBrowseLabel}>Latest</span>
            <strong style={styles.quickBrowseValue}>{content.latest.length || 0} fresh drops</strong>
          </Link>
          <Link to="/browse?language=Bengali" style={styles.quickBrowseCard}>
            <span style={styles.quickBrowseLabel}>Bengali</span>
            <strong style={styles.quickBrowseValue}>{content.bengali.length || 0} local picks</strong>
          </Link>
          <Link to="/browse" style={styles.quickBrowseCard}>
            <span style={styles.quickBrowseLabel}>Search</span>
            <strong style={styles.quickBrowseValue}>Use inline search and filters</strong>
          </Link>
        </section>

        {loading && <div style={styles.loadingNotice}>Refreshing the showcase…</div>}

        {content.continueWatching.length > 0 && (
          <ContentRail
            title="Continue Watching"
            subtitle="Resume instantly"
            items={content.continueWatching}
            type="continue"
            viewAllLink="/watchlist"
          />
        )}

        <ContentRail
          title="Trending Right Now"
          subtitle="Most watched this week"
          items={content.trending}
          type="popular"
          viewAllLink="/browse?sort=trending"
          priorityCount={4}
        />

        <ContentRail
          title="Popular on ISP Portal"
          subtitle="Crowd favorites"
          items={content.popular}
          type="popular"
          viewAllLink="/browse?sort=popular"
          priorityCount={3}
        />

        <ContentRail
          title="Latest Releases"
          subtitle="Just added"
          items={content.latest}
          viewAllLink="/browse?sort=latest"
          priorityCount={4}
        />

        <ContentRail
          title="Movies"
          subtitle="Lean-back movie night"
          items={content.movies}
          viewAllLink="/movies"
        />

        <ContentRail
          title="Series"
          subtitle="Binge-ready chapters"
          items={content.series}
          type="series"
          viewAllLink="/series"
        />

        {content.bengali.length > 0 && (
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
  content: {
    position: 'relative',
    zIndex: 1,
    paddingBottom: 'var(--spacing-3xl)',
  },
  commandDeck: {
    maxWidth: '1400px',
    margin: '-38px auto 18px auto',
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
    margin: '-18px auto 14px auto',
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
    gridTemplateColumns: '1fr',
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
  quickBrowse: {
    maxWidth: '1400px',
    margin: '0 auto 4px auto',
    padding: '0 var(--spacing-lg)',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  quickBrowseTablet: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  quickBrowseMobile: {
    padding: '0 var(--spacing-md)',
    gridTemplateColumns: '1fr',
  },
  quickBrowseCard: {
    padding: '14px 16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '6px',
  },
  quickBrowseLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontWeight: '700',
  },
  quickBrowseValue: {
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    lineHeight: '1.35',
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
