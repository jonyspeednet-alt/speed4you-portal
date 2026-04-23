import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contentService, searchService } from '../services';
import { useBreakpoint } from '../hooks';

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

function BrowsePage({ type }) {
  const { isMobile, isTablet } = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGenre, setSelectedGenre] = useState(() => normalizeQuery(searchParams.get('genre')));
  const [selectedLanguage, setSelectedLanguage] = useState(() => normalizeQuery(searchParams.get('language')));
  const [sortBy, setSortBy] = useState(() => normalizeQuery(searchParams.get('sort'), 'latest'));
  const [selectedCollection, setSelectedCollection] = useState(() => normalizeQuery(searchParams.get('collection')));
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
  const [page, setPage] = useState(() => Number(searchParams.get('page') || 1));
  const [content, setContent] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const deferredSearchText = useDeferredValue(searchText);

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    if (nextQuery !== searchText) {
      setSearchText(nextQuery);
    }
  }, [searchParams, searchText]);

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

  useEffect(() => {
    setPage(1);
  }, [deferredSearchText, selectedGenre, selectedLanguage, selectedCollection, sortBy, type]);

  useEffect(() => {
    let cancelled = false;

    async function fetchContent() {
      const isLoadMore = page > 1;

      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        setError('');

        const params = {
          type,
          genre: selectedGenre !== 'All' ? selectedGenre : undefined,
          language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
          collection: selectedCollection !== 'All' ? selectedCollection : undefined,
          q: deferredSearchText.trim() || undefined,
          sort: sortBy,
          page,
          limit: PAGE_SIZE,
        };

        const result = await contentService.browse(params);
        const nextItems = Array.isArray(result.items) ? result.items.map(normalizeItem) : [];

        if (!cancelled) {
          setContent((current) => (isLoadMore ? [...current, ...nextItems] : nextItems));
          setTotal(Number(result.total || 0));
        }
      } catch (err) {
        console.error('Failed to fetch content:', err);

        if (!cancelled) {
          if (!isLoadMore) {
            setContent([]);
          }
          setError(err.message || 'Failed to load content.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    fetchContent();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchText, page, selectedCollection, selectedGenre, selectedLanguage, sortBy, type]);

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
  const hasMore = content.length < total;
  const highRatedCount = filteredContent.filter((item) => Number(item.rating) >= 8).length;
  const reviewNeededCount = filteredContent.filter((item) => item.metadataStatus === 'needs_review').length;
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
              onChange={(event) => setSearchText(event.target.value)}
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
              <strong style={styles.insightValue}>{loading ? '...' : filteredContent.length}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Top Rated</span>
              <strong style={styles.insightValue}>{loading ? '...' : highRatedCount}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Latest Year</span>
              <strong style={styles.insightValue}>{loading ? '...' : newestYear || 'N/A'}</strong>
            </div>
            <div style={styles.insightCard}>
              <span style={styles.insightLabel}>Needs Review</span>
              <strong style={styles.insightValue}>{loading ? '...' : reviewNeededCount}</strong>
            </div>
          </div>
        </div>

        <div style={{ ...styles.commandPanel, ...(isMobile ? styles.commandPanelMobile : {}) }}>
          <div style={styles.filterGrid}>
            <label style={styles.filterField}>
              <span style={styles.filterLabel}>Genre</span>
              <select value={selectedGenre} onChange={(event) => setSelectedGenre(event.target.value)} style={styles.select}>
                {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </label>

            <label style={styles.filterField}>
              <span style={styles.filterLabel}>Language</span>
              <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)} style={styles.select}>
                {languageOptions.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </label>

            <label style={styles.filterField}>
              <span style={styles.filterLabel}>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>
                <option value="latest">Latest</option>
                <option value="popular">Popular</option>
                <option value="trending">Trending</option>
                <option value="rating">Top Rated</option>
                <option value="featured">Featured Order</option>
              </select>
            </label>

            <label style={styles.filterField}>
              <span style={styles.filterLabel}>Collection</span>
              <select value={selectedCollection} onChange={(event) => setSelectedCollection(event.target.value)} style={styles.select}>
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
        </div>
      </section>

      <div style={{ ...styles.quickChips, ...(isMobile ? styles.quickChipsMobile : {}) }}>
        {genreOptions.slice(0, 8).map((genre) => (
          <button
            key={genre}
            type="button"
            onClick={() => setSelectedGenre(genre)}
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
          {loading ? 'Refreshing...' : hasActiveQuery ? `${total} ranked matches for "${deferredSearchText.trim()}"` : `${filteredContent.length} of ${total} titles visible`}
        </strong>
      </div>

      {loading ? (
        <div style={styles.empty}>
          <p>Loading premium picks...</p>
        </div>
      ) : error ? (
        <div style={styles.empty}>
          <p>{error}</p>
        </div>
      ) : (
        <>
      <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
            {filteredContent.map((item, index) => (
              <Link
                key={item.id}
                to={item.type === 'series' ? `/series/${item.id}` : `/movies/${item.id}`}
                style={styles.card}
              >
                <div style={styles.posterWrapper}>
                  <img src={item.poster} alt={item.title} style={styles.poster} loading="lazy" />
                  <div style={styles.overlay} />
                  <div style={styles.rankBadge}>{String(index + 1).padStart(2, '0')}</div>
                  <div style={styles.meta}>
                    <span style={styles.rating}>★ {item.rating}</span>
                    <span style={styles.badge}>{item.type === 'series' ? 'Series' : 'Movie'}</span>
                  </div>
                </div>
                <div style={styles.info}>
                  <div style={styles.infoTop}>
                    <h3 style={styles.cardTitle}>{item.title}</h3>
                    {item.metadataStatus === 'needs_review' && (
                      <span style={styles.reviewBadge}>Review</span>
                    )}
                  </div>
                  <span style={styles.cardMeta}>{`${item.genre} | ${item.year}`}</span>
                  <span style={styles.languageMeta}>{`${item.language}${item.runtime ? ` | ${item.runtime} min` : ''}`}</span>
                  {item.collection ? <span style={styles.collectionMeta}>{item.collection}</span> : null}
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div style={styles.loadMoreWrap}>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                style={styles.loadMoreButton}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading More...' : 'Load More Titles'}
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && filteredContent.length === 0 && (
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
    position: 'sticky',
    top: '78px',
    zIndex: 20,
    backdropFilter: 'blur(18px)',
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
    fontSize: 'clamp(2.4rem, 5vw, 4.4rem)',
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
  gridMobile: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
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
  loadMoreWrap: {
    maxWidth: '1400px',
    margin: '24px auto 0 auto',
    display: 'flex',
    justifyContent: 'center',
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
