import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { contentService, searchService } from '../services';
import { useBreakpoint } from '../hooks';
import { CardSkeleton } from '../components/feedback/Skeleton';
import WatchlistButton from '../components/ui/WatchlistButton';
import QuickViewModal from '../components/ui/QuickViewModal';

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
  if (!value || value === 'undefined' || value === 'null') return fallback;
  return value;
}

function BrowseCard({ item, isMobile, onQuickView }) {
  const [hovered, setHovered] = useState(false);
  const genre = String(item.genre || 'Featured').split(',')[0].trim();
  const isSeries = item.type === 'series';

  return (
    <article style={styles.cardShell} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button type="button" className="browse-card" style={styles.cardButton} onClick={() => onQuickView(item)}>
        <div style={{
          ...styles.posterWrap,
          transform: hovered && !isMobile ? 'translateY(-5px) scale(1.02)' : 'translateY(0) scale(1)',
          boxShadow: hovered && !isMobile
            ? '0 24px 56px rgba(0,0,0,0.5), 0 0 0 1px rgba(121,228,255,0.16), 0 0 40px rgba(255,143,83,0.08)'
            : '0 8px 28px rgba(0,0,0,0.3)',
          borderColor: hovered && !isMobile ? 'rgba(121,228,255,0.14)' : 'rgba(255,255,255,0.07)',
        }}>
          <img src={item.poster} alt={item.title} style={{
            ...styles.poster,
            transform: hovered && !isMobile ? 'scale(1.06)' : 'scale(1)',
          }} loading="lazy" />
          <div style={styles.posterOverlay} />

          <div style={styles.posterTop}>
            <span style={styles.typeBadge}>{isSeries ? 'Series' : 'Movie'}</span>
            {item.rating ? (
              <span style={styles.ratingBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--accent-tertiary)" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {item.rating}
              </span>
            ) : null}
          </div>

          <div style={styles.posterBottom}>
            <h3 style={styles.posterTitle}>{item.title}</h3>
            <div style={styles.posterMeta}>
              <span style={styles.genrePill}>{genre}</span>
              {item.year ? <span style={styles.yearText}>{item.year}</span> : null}
            </div>
          </div>

          {!isMobile && hovered ? (
            <div style={styles.hoverOverlay}>
              <div style={styles.playCircle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#08111d" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <span style={styles.hoverLabel}>Quick View</span>
            </div>
          ) : null}
        </div>

        <div style={styles.cardInfo}>
          <div style={styles.cardMeta}>
            <span>{item.language}</span>
            <span style={styles.metaDot}>·</span>
            <span>{item.year}</span>
            {item.runtime ? <><span style={styles.metaDot}>·</span><span>{item.runtime}m</span></> : null}
            {item.metadataStatus === 'needs_review' ? <span style={styles.reviewBadge}>Review</span> : null}
          </div>
        </div>
      </button>

      <div style={styles.watchlistSlot}>
        <WatchlistButton contentType={isSeries ? 'series' : 'movie'} contentId={item.id} title={item.title} compact />
      </div>
    </article>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState(null);
  const loadMoreRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const deferredSearchText = useDeferredValue(searchText);

  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current === type) return;
    prevTypeRef.current = type;

    // Reset filters when type changes.
    // To avoid lint warning about calling setState in effect, we can use a setTimeout
    // or just ignore it if we know it's what we want.
    // However, the best way is to do it during render if possible,
    // but here we want to trigger side effects (search params update).
    setTimeout(() => {
      setSelectedGenre('All');
      setSelectedLanguage('All');
      setSortBy('latest');
      setSelectedCollection('All');
      setSearchText('');
    }, 0);
  }, [type]);

  useEffect(() => {
    const nextParams = {};
    if (selectedGenre !== 'All') nextParams.genre = selectedGenre;
    if (selectedLanguage !== 'All') nextParams.language = selectedLanguage;
    if (sortBy !== 'latest') nextParams.sort = sortBy;
    if (selectedCollection !== 'All') nextParams.collection = selectedCollection;
    if (deferredSearchText.trim()) nextParams.q = deferredSearchText.trim();
    setSearchParams(nextParams, { replace: true });
  }, [deferredSearchText, selectedCollection, selectedGenre, selectedLanguage, setSearchParams, sortBy]);

  const params = useMemo(() => ({
    type,
    genre: selectedGenre !== 'All' ? selectedGenre : undefined,
    language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
    collection: selectedCollection !== 'All' ? selectedCollection : undefined,
    q: deferredSearchText.trim() || undefined,
    sort: sortBy,
    limit: PAGE_SIZE,
  }), [type, selectedGenre, selectedLanguage, selectedCollection, deferredSearchText, sortBy]);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, error, refetch } = useInfiniteQuery({
    queryKey: ['browse', params],
    queryFn: ({ pageParam = 1 }) => contentService.fetchBrowsePage({ pageParam, ...params }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const content = useMemo(() => data?.pages.flatMap((page) => page.items || [])?.map(normalizeItem) || [], [data]);
  const total = data?.pages[0]?.total || 0;

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      const query = deferredSearchText.trim();
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const result = await searchService.getSuggestions(query);
        if (!cancelled) setSuggestions(Array.isArray(result.items) ? result.items.slice(0, 6) : []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [deferredSearchText]);

  const collectionOptions = useMemo(() => ['All', ...Array.from(new Set(content.map((item) => item.collection).filter(Boolean)))], [content]);
  const languageOptions = useMemo(() => ['All', ...Array.from(new Set([...QUICK_LANGUAGES.slice(1), ...content.map((item) => item.language).filter(Boolean)]))], [content]);
  const genreOptions = useMemo(() => {
    const dynamicGenres = Array.from(new Set(content.flatMap((item) => String(item.genre || '').split(',')).map((entry) => entry.trim()).filter(Boolean)));
    return ['All', ...Array.from(new Set([...QUICK_GENRES.slice(1), ...dynamicGenres]))];
  }, [content]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const pageTitle = type === 'movie' ? 'Movies' : type === 'series' ? 'Series' : 'Browse';
  const pageDescription = type === 'movie'
    ? 'A sharper movie shelf with stronger filtering, calmer spacing, and better scan rhythm.'
    : type === 'series'
      ? 'Track longer stories with tighter discovery, clearer metadata, and cleaner results.'
      : 'Explore the full catalog with a redesigned discovery workspace built for speed.';

  const activeFilterCount = [selectedGenre !== 'All', selectedLanguage !== 'All', selectedCollection !== 'All', deferredSearchText.trim().length > 0, sortBy !== 'latest'].filter(Boolean).length;

  function resetFilters() {
    setSelectedGenre('All');
    setSelectedLanguage('All');
    setSelectedCollection('All');
    setSortBy('latest');
    setSearchText('');
  }

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
        <div style={styles.heroCopy}>
          <span style={styles.heroEyebrow}>Discovery workspace</span>
          <h1 style={styles.heroTitle}>{pageTitle}</h1>
          <p style={styles.heroDescription}>{pageDescription}</p>

          <div style={styles.searchBar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.searchIcon} aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search title, year, language, genre..."
              style={styles.searchInput}
            />
          </div>

          <div style={{ ...styles.chipRow, ...(isMobile ? styles.chipRowMobile : {}) }}>
            {TRENDING_SEARCHES.map((term) => (
              <button key={term} type="button" onClick={() => setSearchText(term)} style={styles.trendingChip}>
                {term}
              </button>
            ))}
          </div>

          {suggestions.length > 0 ? (
            <div style={{ ...styles.suggestions, ...(isMobile ? styles.chipRowMobile : {}) }}>
              {suggestions.map((item) => (
                <button key={`${item.type}-${item.id}`} type="button" onClick={() => setSearchText(item.title)} style={styles.suggestionChip}>
                  {item.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <aside style={styles.filterPanel}>
          {isMobile ? (
            <button type="button" onClick={() => setFiltersOpen((value) => !value)} style={styles.mobileFilterToggle}>
              <span>{activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}</span>
              <span>{filtersOpen ? 'Hide' : 'Show'}</span>
            </button>
          ) : null}

          <div style={{ ...styles.filterInner, ...(isMobile && !filtersOpen ? styles.filterInnerHidden : {}) }}>
            <FilterField label="Genre" value={selectedGenre} onChange={setSelectedGenre} options={genreOptions} />
            <FilterField label="Language" value={selectedLanguage} onChange={setSelectedLanguage} options={languageOptions} />
            <FilterField label="Sort" value={sortBy} onChange={setSortBy} options={['latest', 'popular', 'trending', 'rating', 'featured']} />
            <FilterField label="Collection" value={selectedCollection} onChange={setSelectedCollection} options={collectionOptions} />

            <div style={styles.filterFooter}>
              <button type="button" onClick={resetFilters} style={styles.resetButton}>Reset</button>
              <span style={styles.filterStatus}>{activeFilterCount ? `${activeFilterCount} active filters` : 'All titles visible'}</span>
            </div>
          </div>
        </aside>
      </section>

      <div style={{ ...styles.genreStrip, ...(isMobile ? styles.genreStripMobile : {}) }}>
        {genreOptions.slice(0, 8).map((genre) => (
          <button
            key={genre}
            type="button"
            onClick={() => setSelectedGenre(genre)}
            style={{ ...styles.genreChip, ...(selectedGenre === genre ? styles.genreChipActive : {}) }}
          >
            {genre}
          </button>
        ))}
      </div>

      <section style={styles.summaryPanel}>
        <div style={styles.summaryText}>
          <span style={styles.summaryLabel}>Results</span>
          <strong style={styles.summaryValue}>
            {isFetching && !isFetchingNextPage ? 'Refreshing results...' : deferredSearchText.trim() ? `${total} matches for "${deferredSearchText.trim()}"` : `${content.length} visible from ${total} titles`}
          </strong>
        </div>
        <div style={styles.summaryStats}>
          <span style={styles.statPill}>{selectedLanguage === 'All' ? 'All languages' : selectedLanguage}</span>
          <span style={styles.statPill}>{sortBy}</span>
        </div>
      </section>

      {isLoading ? (
        <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : isTablet ? styles.gridTablet : {}) }}>
          {Array.from({ length: 12 }).map((_, index) => <CardSkeleton key={index} />)}
        </div>
      ) : error ? (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>Error loading content</h2>
          <p style={styles.emptyText}>{error.message || 'An unexpected error occurred.'}</p>
          <button type="button" onClick={() => refetch({ cancelRefetch: false })} style={styles.resetButton}>Retry</button>
        </div>
      ) : (
        <>
          <div className="browse-grid" style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : isTablet ? styles.gridTablet : {}) }}>
            {content.map((item) => (
              <BrowseCard key={item.id} item={item} isMobile={isMobile} onQuickView={setQuickViewItem} />
            ))}
          </div>

          {hasNextPage ? (
            <div ref={loadMoreRef} style={styles.loadMoreWrap}>
              {isFetchingNextPage ? <div style={styles.loader}>Loading more...</div> : null}
            </div>
          ) : null}
        </>
      )}

      {!isLoading && !error && content.length === 0 ? (
        <div style={styles.emptyState}>
          <h2 style={styles.emptyTitle}>No content matched this selection.</h2>
          <p style={styles.emptyText}>Try broader filters, another language, or a simpler search term.</p>
          <button type="button" onClick={resetFilters} style={styles.resetButton}>Clear filters</button>
        </div>
      ) : null}

      <QuickViewModal isOpen={!!quickViewItem} item={quickViewItem} onClose={() => setQuickViewItem(null)} />
    </div>
  );
}

function FilterField({ label, value, onChange, options }) {
  return (
    <label style={styles.filterField}>
      <span style={styles.filterLabel}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="browse-filter-button" style={styles.select}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: 'calc(var(--nav-occupied-desktop) + 8px) 24px var(--spacing-3xl)',
  },
  pageMobile: {
    padding: 'calc(var(--nav-occupied-mobile) + 8px) 12px var(--spacing-2xl)',
  },
  hero: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto 16px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 360px',
    gap: '18px',
    padding: '24px',
    borderRadius: '34px',
    background: 'rgba(13, 26, 45, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
  },
  heroTablet: {
    width: 'min(1440px, calc(100vw - 28px))',
    gridTemplateColumns: '1fr',
  },
  heroMobile: {
    width: '100%',
    gridTemplateColumns: '1fr',
    padding: '16px',
    borderRadius: '26px',
  },
  heroCopy: {
    display: 'grid',
    gap: '14px',
  },
  heroEyebrow: {
    color: 'var(--accent-pink)',
    fontSize: '0.72rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 'clamp(2.4rem, 5vw, 4rem)',
    fontWeight: '900',
    letterSpacing: '-0.02em',
  },
  heroDescription: {
    maxWidth: '58ch',
    fontSize: '1rem',
    lineHeight: '1.7',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  searchBar: {
    position: 'relative',
    minHeight: '62px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 18px 0 48px',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  searchIcon: {
    position: 'absolute',
    left: '18px',
    color: 'var(--accent-cyan)',
  },
  searchInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '1rem',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  chipRowMobile: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  trendingChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(121, 228, 255, 0.1)',
    border: '1px solid rgba(121, 228, 255, 0.18)',
    color: 'var(--accent-secondary)',
    fontSize: '0.8rem',
    fontWeight: '800',
  },
  suggestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  suggestionChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    fontWeight: '700',
  },
  filterPanel: {
    padding: '18px',
    borderRadius: '28px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  mobileFilterToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-primary)',
    fontWeight: '800',
  },
  filterInner: {
    display: 'grid',
    gap: '12px',
  },
  filterInnerHidden: {
    display: 'none',
  },
  filterField: {
    display: 'grid',
    gap: '8px',
  },
  filterLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  select: {
    minHeight: '48px',
    padding: '0 14px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.06)',
    color: 'var(--text-primary)',
  },
  filterFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
  },
  filterStatus: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  },
  resetButton: {
    minHeight: '44px',
    padding: '0 20px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-secondary) 100%)',
    color: '#050c16',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: '0.76rem',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.2)',
  },
  genreStrip: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto 14px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  genreStripMobile: {
    width: '100%',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  genreChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '800',
  },
  genreChipActive: {
    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-secondary) 100%)',
    color: '#050c16',
    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
  },
  summaryPanel: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto 16px',
    padding: '16px 18px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  summaryText: {
    display: 'grid',
    gap: '4px',
  },
  summaryLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
  },
  summaryValue: {
    color: 'var(--text-primary)',
    fontSize: '0.96rem',
  },
  summaryStats: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  statPill: {
    padding: '9px 12px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-secondary)',
    fontSize: '0.76rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  grid: {
    width: 'min(1440px, calc(100vw - 48px))',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '18px',
  },
  gridTablet: {
    width: 'min(1440px, calc(100vw - 28px))',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '14px',
  },
  gridMobile: {
    width: '100%',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '12px',
  },
  cardShell: {
    position: 'relative',
  },
  cardButton: {
    width: '100%',
    textAlign: 'left',
    display: 'grid',
    gap: '8px',
  },
  posterWrap: {
    position: 'relative',
    aspectRatio: '2 / 3',
    borderRadius: '14px',
    overflow: 'hidden',
    background: '#0d1a2d',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transition: 'all 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  poster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  posterOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.08) 45%, rgba(5,12,22,0.9) 100%)',
    pointerEvents: 'none',
  },
  posterTop: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    right: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '6px',
    zIndex: 1,
  },
  typeBadge: {
    padding: '5px 10px',
    borderRadius: '6px',
    background: 'rgba(5, 12, 22, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#ffffff',
    fontSize: '0.62rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  ratingBadge: {
    padding: '5px 9px',
    borderRadius: '6px',
    background: 'rgba(5, 12, 22, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'var(--accent-cyan)',
    fontSize: '0.68rem',
    fontWeight: '900',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  posterBottom: {
    position: 'absolute',
    left: '10px',
    right: '10px',
    bottom: '10px',
    zIndex: 1,
  },
  posterTitle: {
    color: '#fff',
    fontSize: '0.88rem',
    fontWeight: '700',
    lineHeight: '1.3',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginBottom: '6px',
    textShadow: '0 2px 10px rgba(0,0,0,0.6)',
    letterSpacing: '-0.01em',
  },
  posterMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  genrePill: {
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
    fontSize: '0.62rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  yearText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.68rem',
    fontWeight: '600',
  },
  hoverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(2px)',
    zIndex: 2,
  },
  playCircle: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    paddingLeft: '3px',
  },
  hoverLabel: {
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  cardInfo: {
    padding: '0 2px',
  },
  reviewBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'rgba(255, 209, 102, 0.14)',
    color: 'var(--accent-tertiary)',
    fontSize: '0.6rem',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flexWrap: 'wrap',
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
  },
  metaDot: {
    opacity: 0.4,
    fontSize: '0.6rem',
  },
  watchlistSlot: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 3,
  },
  loadMoreWrap: {
    width: 'min(1440px, calc(100vw - 48px))',
    minHeight: '56px',
    margin: '22px auto 0',
    display: 'grid',
    placeItems: 'center',
  },
  loader: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  emptyState: {
    width: 'min(900px, calc(100vw - 48px))',
    margin: '0 auto',
    padding: '48px 24px',
    borderRadius: '32px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
  },
  emptyTitle: {
    marginBottom: '10px',
    color: 'var(--text-primary)',
  },
  emptyText: {
    marginBottom: '18px',
  },
};

export default BrowsePage;
