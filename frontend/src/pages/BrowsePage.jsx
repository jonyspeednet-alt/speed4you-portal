import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { contentService, searchService } from '../services';
import { useBreakpoint } from '../hooks';
import { CardSkeleton } from '../components/feedback/Skeleton';
import WatchlistButton from '../components/ui/WatchlistButton';

const QUICK_GENRES = ['All', 'Action', 'Drama', 'Comedy', 'Horror', 'Romance', 'Thriller', 'Crime'];
const QUICK_LANGUAGES = ['All', 'English', 'Bengali', 'Hindi', 'Korean', 'Japanese'];
const TRENDING_SEARCHES = ['Action', 'Bangla Dubbed', 'Korean', 'Thriller', '2025', 'Crime'];
const PAGE_SIZE = 24;
const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';

function normalizeItem(item) {
  return {
    ...item,
    poster: item.poster || posterFallback,
    backdrop: item.backdrop || item.poster || posterFallback,
    year: item.year || 'Unknown',
    rating: item.rating || 'N/A',
    genre: item.genre || 'Uncategorized',
    language: item.language || 'Unknown',
    runtime: item.runtime || null,
    metadataStatus: item.metadataStatus || 'matched',
  };
}

function normalizeQuery(value, fallback = 'All') {
  if (!value || value === 'undefined' || value === 'null') {
    return fallback;
  }

  return value;
}

function BrowseCard({ item, index, isMobile }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={styles.cardWrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={item.type === 'series' ? `/series/${item.id}` : `/movies/${item.id}`}
        style={styles.card}
      >
        <div style={{
          ...styles.posterWrapper,
          transform: hovered && !isMobile ? 'scale(1.02)' : 'scale(1)',
          boxShadow: hovered && !isMobile
            ? '0 24px 48px rgba(0,0,0,0.5), 0 0 28px rgba(255,90,95,0.18)'
            : 'var(--shadow-card)',
          transition: 'transform 280ms ease, box-shadow 280ms ease',
        }}>
          <img src={item.poster} alt={item.title} style={styles.poster} loading="lazy" />
          <div style={styles.overlay} />
          <div style={styles.rankBadge}>{String(index + 1).padStart(2, '0')}</div>
          <div style={styles.meta}>
            <span style={styles.rating}>★ {item.rating}</span>
            <span style={styles.badge}>{item.type === 'series' ? 'Series' : 'Movie'}</span>
          </div>
          {hovered && !isMobile && (
            <div style={styles.hoverPlay}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          <div style={styles.cardWatchlistBtn}>
            <WatchlistButton
              contentType={item.type === 'series' ? 'series' : 'movie'}
              contentId={item.id}
              title={item.title}
              compact
            />
          </div>
        </div>
        <div style={styles.info}>
          <div style={styles.infoTop}>
            <h3 style={styles.cardTitle}>{item.title}</h3>
            {item.metadataStatus === 'needs_review' ? (
              <span style={styles.reviewBadge}>Review</span>
            ) : null}
          </div>
          <span style={styles.cardMeta}>{`${item.genre} | ${item.year}`}</span>
          <span style={styles.languageMeta}>{`${item.language}${item.runtime ? ` | ${item.runtime} min` : ''}`}</span>
          {item.collection ? <span style={styles.collectionMeta}>{item.collection}</span> : null}
        </div>
      </Link>
    </div>
  );
}

function BrowsePage({ type }) {
  const { isMobile, isTablet } = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenre, setSelectedGenre] = useState(() => normalizeQuery(searchParams.get('genre')));
  const [selectedLanguage, setSelectedLanguage] = useState(() => normalizeQuery(searchParams.get('language')));
  const [sortBy, setSortBy] = useState(() => normalizeQuery(searchParams.get('sort'), 'latest'));
  const [selectedCollection, setSelectedCollection] = useState(() => normalizeQuery(searchParams.get('collection')));
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
  const [page, setPage] = useState(() => Number(searchParams.get('page') || 1));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loadMoreRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const deferredSearchText = useDeferredValue(searchText);

  // Reset filters when type prop changes (e.g. /movies → /series)
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;
    // Batch all resets — intentional setState calls in response to prop change
    /* eslint-disable react-hooks/set-state-in-effect */
    setSelectedGenre('All');
    setSelectedLanguage('All');
    setSortBy('latest');
    setSelectedCollection('All');
    setSearchText('');
    setPage(1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [type]);

  useEffect(() => {
    const nextParams = {};

    if (selectedGenre !== 'All') nextParams.genre = selectedGenre;
    if (selectedLanguage !== 'All') nextParams.language = selectedLanguage;
    if (sortBy !== 'latest') nextParams.sort = sortBy;
    if (selectedCollection !== 'All') nextParams.collection = selectedCollection;
    if (deferredSearchText.trim()) nextParams.q = deferredSearchText.trim();
    if (page > 1) nextParams.page = String(page);

    setSearchParams(nextParams, { replace: true });
  }, [deferredSearchText, page, selectedCollection, selectedGenre, selectedLanguage, setSearchParams, sortBy]);

  const params = useMemo(() => ({
    type,
    genre: selectedGenre !== 'All' ? selectedGenre : undefined,
    language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
    collection: selectedCollection !== 'All' ? selectedCollection : undefined,
    q: deferredSearchText.trim() || undefined,
    sort: sortBy,
    limit: PAGE_SIZE,
  }), [type, selectedGenre, selectedLanguage, selectedCollection, deferredSearchText, sortBy]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['browse', params],
    queryFn: ({ pageParam = 1 }) => contentService.fetchBrowsePage({ pageParam, ...params }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const content = useMemo(() => {
    return data?.pages.flatMap(page => page.items || [])?.map(normalizeItem) || [];
  }, [data]);

  const total = data?.pages[0]?.total || 0;

  useEffect(() => {
    let cancelled = false;
    const query = deferredSearchText.trim();

    async function fetchSuggestions() {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const result = await searchService.getSuggestions(query);
        if (!cancelled) {
          setSuggestions(Array.isArray(result.items) ? result.items.slice(0, 6) : []);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      }
    }

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchText]);

  const filteredContent = useMemo(() => content, [content]);

  const collectionOptions = useMemo(() => {
    const dynamicCollections = Array.from(new Set(content.map((item) => item.collection).filter(Boolean)));
    return ['All', ...dynamicCollections];
  }, [content]);

  const languageOptions = useMemo(() => {
    const dynamicLanguages = Array.from(new Set(content.map((item) => item.language).filter(Boolean)));
    return ['All', ...Array.from(new Set([...QUICK_LANGUAGES.slice(1), ...dynamicLanguages]))];
  }, [content]);

  const genreOptions = useMemo(() => {
    const dynamicGenres = Array.from(new Set(
      content
        .flatMap((item) => String(item.genre || '').split(','))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ));

    return ['All', ...Array.from(new Set([...QUICK_GENRES.slice(1), ...dynamicGenres]))];
  }, [content]);

  const pageTitle = type === 'movie' ? 'Movies' : type === 'series' ? 'Series' : 'Browse';
  const pageDescription = type === 'movie'
    ? 'Lean into a smarter movie shelf with stronger filters, faster scanning, and cleaner poster-first decisions.'
    : type === 'series'
      ? 'Track binge-worthy stories with clearer seasons, tighter search, and faster discovery.'
      : 'Explore the full premium catalog with sharper search, faster filters, and richer result intelligence.';
  const activeFilterCount = [selectedGenre !== 'All', selectedLanguage !== 'All', selectedCollection !== 'All', deferredSearchText.trim().length > 0, sortBy !== 'latest'].filter(Boolean).length;
  const hasMore = hasNextPage;
  const highRatedCount = filteredContent.filter((item) => Number(item.rating) >= 8).length;
  const reviewNeededCount = filteredContent.filter((item) => item.metadataStatus === 'needs_review').length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) fetchNextPage(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const newestYear = filteredContent.reduce((maxYear, item) => Math.max(maxYear, Number(item.year) || 0), 0);
  const hasActiveQuery = deferredSearchText.trim().length > 0;

  function resetFilters() {
    setSelectedGenre('All');
    setSelectedLanguage('All');
    setSelectedCollection('All');
    setSortBy('latest');
    setSearchText('');
    setPage(1);
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
        <div style={styles.heroCopy}>
          <span style={styles.kicker}>Discovery Mode</span>
          <h1 style={styles.title}>{pageTitle}</h1>
          <p style={styles.description}>{pageDescription}</p>

          <div style={styles.heroSearchBar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.heroSearchIcon}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              name="browse_search"
              autoComplete="off"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                setPage(1);
              }}
              placeholder="Search title, genre, year, language..."
              style={styles.heroSearchInput}
            />
          </div>

          <div style={{ ...styles.trendingSearchRow, ...(isMobile ? styles.trendingSearchRowMobile : {}) }}>
            {TRENDING_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setSearchText(term);
                  setPage(1);
                }}
                style={styles.trendingSearchChip}
              >
                {term}
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <div style={{ ...styles.suggestionRow, ...(isMobile ? styles.quickChipsMobile : {}) }}>
              {suggestions.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => {
                    setSearchText(item.title);
                    setPage(1);
                  }}
                  style={styles.suggestionChip}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}

          <div style={{ ...styles.insightRow, ...(isMobile ? styles.insightRowMobile : isTablet ? styles.insightRowTablet : {}) }}>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Visible Now</span>
              <strong style={styles.insightValue}>{isLoading ? '...' : filteredContent.length}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Top Rated</span>
              <strong style={styles.insightValue}>{isLoading ? '...' : highRatedCount}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Latest Year</span>
              <strong style={styles.insightValue}>{isLoading ? '...' : newestYear || 'N/A'}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Needs Review</span>
              <strong style={styles.insightValue}>{isLoading ? '...' : reviewNeededCount}</strong>
            </div>
          </div>
        </div>

        <div style={{ ...styles.commandPanel, ...(isMobile ? styles.commandPanelMobile : {}) }}>
          {/* Mobile: collapsible toggle */}
          {isMobile && (
            <button
              style={styles.filterToggleBtn}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls="filter-panel"
            >
              <span>
                {activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Filters'}
              </span>
              <svg
                viewBox="0 0 24 24" width="18" height="18" fill="currentColor"
                style={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
                aria-hidden="true"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          )}

          <div
            id="filter-panel"
            style={{
              ...styles.filterPanelInner,
              ...(isMobile && !filtersOpen ? styles.filterPanelHidden : {}),
            }}
          >
            <div style={styles.filterGrid}>
              <label style={styles.filterField}>
                <span style={styles.filterLabel}>Genre</span>
                <select
                  value={selectedGenre}
                  onChange={(event) => {
                    setSelectedGenre(event.target.value);
                    setPage(1);
                  }}
                  style={styles.select}
                >
                  {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </label>

              <label style={styles.filterField}>
                <span style={styles.filterLabel}>Language</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => {
                    setSelectedLanguage(event.target.value);
                    setPage(1);
                  }}
                  style={styles.select}
                >
                  {languageOptions.map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
              </label>

              <label style={styles.filterField}>
                <span style={styles.filterLabel}>Sort</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setPage(1);
                  }}
                  style={styles.select}
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Popular</option>
                  <option value="trending">Trending</option>
                  <option value="rating">Top Rated</option>
                  <option value="featured">Featured Order</option>
                </select>
              </label>

              <label style={styles.filterField}>
                <span style={styles.filterLabel}>Collection</span>
                <select
                  value={selectedCollection}
                  onChange={(event) => {
                    setSelectedCollection(event.target.value);
                    setPage(1);
                  }}
                  style={styles.select}
                >
                  {collectionOptions.map((collection) => <option key={collection} value={collection}>{collection}</option>)}
                </select>
              </label>
            </div>

            <div style={styles.actionRow}>
              <button type="button" onClick={resetFilters} style={styles.resetButton}>
                Reset Filters
              </button>
              <span style={styles.filterStatus}>
                {activeFilterCount ? `${activeFilterCount} filters active` : 'Browsing all available titles'}
              </span>
            </div>
          </div>{/* end filterPanelInner */}
        </div>
      </section>

      <div style={{ ...styles.quickChips, ...(isMobile ? styles.quickChipsMobile : {}) }}>
        {genreOptions.slice(0, 8).map((genre) => (
          <button
            key={genre}
            type="button"
            onClick={() => {
              setSelectedGenre(genre);
              setPage(1);
            }}
            style={{
              ...styles.chip,
              ...(selectedGenre === genre ? styles.chipActive : {}),
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      <div style={styles.summaryBar}>
        <span style={styles.summaryLabel}>Browse Results</span>
        <strong style={styles.summaryValue}>
          {isFetching && !isFetchingNextPage ? 'Refreshing...' : hasActiveQuery ? `${total} ranked matches for "${deferredSearchText.trim()}"` : `${filteredContent.length} of ${total} titles visible`}
        </strong>
      </div>

      {isLoading ? (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : isTablet ? styles.gridTablet : {}) }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>Error loading content</h2>
          <p style={styles.emptyText}>{error.message || 'An unexpected error occurred.'}</p>
          <button
            type="button"
            onClick={() => refetch({ cancelRefetch: false })}
            style={styles.resetButton}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : isTablet ? styles.gridTablet : {}) }}>
            {filteredContent.map((item, index) => (
              <BrowseCard key={item.id} item={item} index={index} isMobile={isMobile} />
            ))}
          </div>

          {hasMore && (
            <div ref={loadMoreRef} style={styles.loadMoreWrap}>
              {isFetchingNextPage && (
                <div style={styles.loadingSpinner} aria-label="Loading more titles">
                  <div style={styles.spinnerDot} />
                  <div style={{ ...styles.spinnerDot, animationDelay: '0.15s' }} />
                  <div style={{ ...styles.spinnerDot, animationDelay: '0.3s' }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!isLoading && !error && filteredContent.length === 0 && (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>No content matched this selection.</h2>
          <p style={styles.emptyText}>Try clearing the filters or searching with a broader title, language, or genre.</p>
          <button type="button" onClick={resetFilters} style={styles.resetButton}>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '112px var(--spacing-lg) var(--spacing-3xl)',
  },
  pageMobile: {
    padding: '96px var(--spacing-md) var(--spacing-2xl)',
  },
  hero: {
    maxWidth: '1400px',
    margin: '0 auto 18px auto',
    padding: '24px',
    borderRadius: '28px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.12fr) minmax(300px, 400px)',
    gap: '18px',
    alignItems: 'stretch',
    boxShadow: 'var(--shadow-soft)',
  },
  heroTablet: {
    gridTemplateColumns: '1fr',
  },
  heroMobile: {
    padding: '16px',
    gridTemplateColumns: '1fr',
  },
  heroCopy: {
    display: 'grid',
    gap: '12px',
  },
  kicker: {
    color: 'var(--accent-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  title: {
    fontSize: 'clamp(2rem, 5vw, 4.4rem)',
    color: 'var(--text-primary)',
  },
  description: {
    maxWidth: '52ch',
    lineHeight: '1.65',
  },
  heroSearchBar: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    maxWidth: '640px',
    minHeight: '54px',
    padding: '0 16px 0 44px',
    borderRadius: '999px',
    background: 'rgba(7,17,31,0.62)',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: 'var(--shadow-soft)',
  },
  heroSearchIcon: {
    position: 'absolute',
    left: '16px',
    color: 'var(--text-muted)',
  },
  heroSearchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '1rem',
  },
  trendingSearchRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  trendingSearchRowMobile: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  trendingSearchChip: {
    padding: '9px 14px',
    borderRadius: '999px',
    background: 'rgba(12, 191, 214, 0.12)',
    border: '1px solid rgba(12, 191, 214, 0.24)',
    color: 'var(--accent-cyan)',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  suggestionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  suggestionChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: '700',
  },
  insightRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
    marginTop: '2px',
  },
  insightRowTablet: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  insightRowMobile: {
    gridTemplateColumns: '1fr 1fr',
  },
  insightCard: {
    padding: '14px 16px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  insightLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  insightValue: {
    color: 'var(--text-primary)',
    fontSize: '0.98rem',
    fontWeight: '800',
  },
  commandPanel: {
    display: 'grid',
    gap: '12px',
    padding: '18px',
    borderRadius: '24px',
    background: 'rgba(7,17,31,0.48)',
    border: '1px solid rgba(255,255,255,0.08)',
    alignContent: 'start',
  },
  commandPanelMobile: {
    padding: '14px',
    borderRadius: '20px',
  },
  filterToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.9rem',
    minHeight: '48px',
  },
  filterPanelInner: {
    display: 'grid',
    gap: '12px',
    overflow: 'hidden',
    transition: 'max-height 280ms ease, opacity 200ms ease',
    maxHeight: '1000px',
    opacity: 1,
    marginTop: '10px',
  },
  filterPanelHidden: {
    maxHeight: '0',
    opacity: 0,
    marginTop: '0',
    pointerEvents: 'none',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '10px',
  },
  filterField: {
    display: 'grid',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  select: {
    padding: '13px 14px',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-primary)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    cursor: 'pointer',
    fontSize: '0.92rem',
    backdropFilter: 'blur(10px)',
  },
  actionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  filterStatus: {
    color: 'var(--text-muted)',
    fontSize: '0.84rem',
  },
  resetButton: {
    padding: '12px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
  quickChips: {
    maxWidth: '1400px',
    margin: '0 auto 12px auto',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  quickChipsMobile: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingBottom: '6px',
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '700',
  },
  chipActive: {
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
  },
  summaryBar: {
    maxWidth: '1400px',
    margin: '0 auto 16px auto',
    padding: '0 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  summaryValue: {
    color: 'var(--accent-amber)',
    fontSize: '0.95rem',
  },
  grid: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '18px',
  },
  gridTablet: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '14px',
  },
  gridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  cardWrap: {
    position: 'relative',
  },
  card: {
    display: 'grid',
    gap: '12px',
  },
  posterWrapper: {
    position: 'relative',
    borderRadius: '22px',
    overflow: 'hidden',
    aspectRatio: '3 / 4',
    background: 'var(--bg-tertiary)',
    boxShadow: 'var(--shadow-card)',
  },
  cardWatchlistBtn: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    zIndex: 2,
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 5%, rgba(7,17,31,0.84) 100%)',
  },
  rankBadge: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'rgba(7,17,31,0.72)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: '700',
  },
  meta: {
    position: 'absolute',
    left: '14px',
    right: '14px',
    bottom: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
  },
  rating: {
    background: 'rgba(7,17,31,0.78)',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.76rem',
    color: 'var(--accent-amber)',
    fontWeight: '700',
  },
  badge: {
    background: 'rgba(255,255,255,0.12)',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '0.68rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-primary)',
  },
  info: {
    padding: '2px 2px 0',
    display: 'grid',
    gap: '6px',
  },
  infoTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
  },
  cardTitle: {
    fontSize: '1.02rem',
    color: 'var(--text-primary)',
    lineHeight: '1.18',
    flex: 1,
  },
  reviewBadge: {
    padding: '6px 8px',
    borderRadius: '999px',
    background: 'rgba(255,200,87,0.16)',
    color: 'var(--accent-amber)',
    fontSize: '0.68rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  cardMeta: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
  },
  languageMeta: {
    fontSize: '0.8rem',
    color: 'var(--accent-cyan)',
  },
  collectionMeta: {
    fontSize: '0.76rem',
    color: 'var(--accent-amber)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '700',
  },
  hoverPlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7,17,31,0.38)',
    color: '#fff',
    animation: 'fadeUp 150ms ease',
  },
  loadMoreWrap: {
    maxWidth: '1400px',
    margin: '24px auto 0 auto',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '60px',
    alignItems: 'center',
  },
  loadingSpinner: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  spinnerDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'var(--accent-cyan)',
    animation: 'spinnerBounce 0.8s ease-in-out infinite',
    opacity: 0.7,
  },
  loadMoreButton: {
    padding: '14px 24px',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    fontWeight: '800',
  },
  empty: {
    maxWidth: '1400px',
    margin: '0 auto',
    textAlign: 'center',
    padding: 'var(--spacing-2xl)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    maxWidth: '900px',
    margin: '0 auto',
    textAlign: 'center',
    padding: '48px 24px',
    borderRadius: '32px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    color: 'var(--text-primary)',
    marginBottom: '12px',
  },
  emptyText: {
    marginBottom: '18px',
  },
};

export default BrowsePage;
