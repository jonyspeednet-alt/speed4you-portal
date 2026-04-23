import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import searchService from '../services/searchService';
import { useBreakpoint } from '../hooks';

const posterFallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400';
const languageOptions = ['All', 'English', 'Hindi', 'Bengali', 'Korean', 'Japanese'];
const typeOptions = ['all', 'movie', 'series'];

function normalizeItem(item) {
  return {
    ...item,
    poster: item.poster || posterFallback,
    genre: item.genre || 'Uncategorized',
    language: item.language || 'Unknown',
    year: item.year || 'Unknown',
    rating: item.rating || 'N/A',
  };
}

function SearchPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [selectedType, setSelectedType] = useState(() => searchParams.get('type') || 'all');
  const [selectedLanguage, setSelectedLanguage] = useState(() => searchParams.get('language') || 'All');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const nextParams = {};
    if (deferredQuery.trim()) nextParams.q = deferredQuery.trim();
    if (selectedType !== 'all') nextParams.type = selectedType;
    if (selectedLanguage !== 'All') nextParams.language = selectedLanguage;
    setSearchParams(nextParams, { replace: true });
  }, [deferredQuery, selectedLanguage, selectedType, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!deferredQuery.trim()) {
        setResults([]);
        setSuggestions([]);
        setError('');
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await searchService.search(deferredQuery.trim(), {
          type: selectedType !== 'all' ? selectedType : undefined,
          language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
        });

        if (!cancelled) {
          setResults(Array.isArray(response.results) ? response.results.map(normalizeItem) : []);
          setSuggestions(Array.isArray(response.suggestions) ? response.suggestions : []);
        }
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setSuggestions([]);
          setError(searchError.message || 'Search is unavailable right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, selectedLanguage, selectedType]);

  const verifiedCount = useMemo(
    () => results.filter((item) => item.metadataStatus === 'matched').length,
    [results],
  );

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
        <div style={styles.heroCopy}>
          <span style={styles.kicker}>Intelligent Search</span>
          <h1 style={styles.title}>Find trending, top-rated, and latest media in one place.</h1>
          <p style={styles.description}>
            Search now uses the live catalog, ranking results by title relevance, TMDb confidence, rating, and trend momentum.
          </p>
        </div>

        <div style={{ ...styles.commandCard, ...(isMobile ? styles.commandCardMobile : {}) }}>
          <div style={styles.searchBox}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={styles.searchIcon}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search title, genre, language, year..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={styles.input}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} style={styles.clearBtn}>
                Clear
              </button>
            )}
          </div>

          <div style={{ ...styles.filterRow, ...(isMobile ? styles.twoColMobile : {}) }}>
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} style={styles.select}>
              {typeOptions.map((item) => (
                <option key={item} value={item}>{item === 'all' ? 'All Types' : item === 'movie' ? 'Movies' : 'Series'}</option>
              ))}
            </select>

            <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)} style={styles.select}>
              {languageOptions.map((item) => (
                <option key={item} value={item}>{item === 'All' ? 'All Languages' : item}</option>
              ))}
            </select>
          </div>

          <div style={{ ...styles.statsRow, ...(isMobile ? styles.twoColMobile : {}) }}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Matches</span>
              <strong style={styles.statValue}>{loading ? '...' : results.length}</strong>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Verified</span>
              <strong style={styles.statValue}>{loading ? '...' : verifiedCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <div style={styles.results}>
        {!query.trim() && (
          <div style={styles.hint}>
            <h3 style={styles.hintTitle}>Modern search is now built in</h3>
            <div style={styles.tipGrid}>
              <div style={styles.tipCard}>Search by title, genre, category, year, or language</div>
              <div style={styles.tipCard}>Results are ranked by relevance plus trend score</div>
              <div style={styles.tipCard}>Filter movies vs series instantly</div>
              <div style={styles.tipCard}>Suggestions help you jump to the closest catalog match</div>
            </div>
          </div>
        )}

        {!!query.trim() && suggestions.length > 0 && (
          <div style={styles.suggestionWrap}>
            <span style={styles.suggestionLabel}>Quick Suggestions</span>
            <div style={styles.suggestionChips}>
              {suggestions.map((item) => (
                <button key={`${item.type}-${item.id}`} type="button" onClick={() => setQuery(item.title)} style={styles.suggestionChip}>
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <p style={styles.resultCount}>Searching the live catalog...</p>}
        {!loading && error && <div style={styles.noResults}><p>{error}</p></div>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <div style={styles.noResults}>
            <h3 style={styles.hintTitle}>No direct matches</h3>
            <p>Try broader keywords, a different language, or clear the filters.</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <p style={styles.resultCount}>{results.length} ranked matches found</p>
            <div style={{ ...styles.grid, ...(isMobile ? styles.gridMobile : {}) }}>
              {results.map((item, index) => (
                <Link
                  key={item.id}
                  to={item.type === 'series' ? `/series/${item.id}` : `/movies/${item.id}`}
                  style={styles.card}
                >
                  <div style={styles.posterWrapper}>
                    <img src={item.poster} alt={item.title} style={styles.poster} loading="lazy" />
                    <div style={styles.overlay} />
                    <span style={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                    <span style={styles.badge}>{item.type === 'series' ? 'Series' : 'Movie'}</span>
                  </div>
                  <div style={styles.info}>
                    <div style={styles.infoTop}>
                      <h3 style={styles.cardTitle}>{item.title}</h3>
                      {item.metadataStatus === 'needs_review' && <span style={styles.reviewBadge}>Review</span>}
                    </div>
                    <span style={styles.cardMeta}>{`${item.genre} • ${item.year}`}</span>
                    <span style={styles.languageMeta}>{`${item.language} • ★ ${item.rating}`}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '112px var(--spacing-lg) var(--spacing-3xl)' },
  pageMobile: { padding: '96px var(--spacing-md) var(--spacing-2xl)' },
  hero: {
    maxWidth: '1280px',
    margin: '0 auto 32px auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 440px)',
    gap: '24px',
    alignItems: 'stretch',
  },
  heroTablet: { gridTemplateColumns: '1fr' },
  heroMobile: { gridTemplateColumns: '1fr', gap: '18px', marginBottom: '24px' },
  heroCopy: { display: 'grid', gap: '14px', alignContent: 'center' },
  kicker: { color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.72rem', fontWeight: '700' },
  title: { fontSize: 'clamp(2.4rem, 5vw, 4.6rem)', color: 'var(--text-primary)', maxWidth: '12ch' },
  description: { maxWidth: '58ch', lineHeight: '1.8' },
  commandCard: {
    display: 'grid',
    gap: '16px',
    padding: '22px',
    borderRadius: '28px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'blur(12px)',
  },
  commandCardMobile: {
    padding: '16px',
    borderRadius: '22px',
  },
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px',
    borderRadius: '999px',
    background: 'rgba(7,17,31,0.52)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  searchIcon: { position: 'absolute', left: '24px', color: 'var(--text-muted)' },
  input: { width: '100%', padding: '18px 120px 18px 54px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.05rem', outline: 'none' },
  clearBtn: { position: 'absolute', right: '12px', padding: '12px 18px', borderRadius: '999px', background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)', color: '#fff', fontWeight: '700' },
  filterRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  select: { padding: '14px 16px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', cursor: 'pointer', fontSize: '0.92rem' },
  statsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  twoColMobile: { gridTemplateColumns: '1fr' },
  statCard: { padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' },
  statLabel: { display: 'block', marginBottom: '8px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', fontWeight: '700' },
  statValue: { color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '800' },
  results: { maxWidth: '1280px', margin: '0 auto' },
  hint: { textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--spacing-xl) 0' },
  hintTitle: { color: 'var(--text-primary)', marginBottom: '16px' },
  tipGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  tipCard: { padding: '18px', borderRadius: '22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' },
  suggestionWrap: { marginBottom: '18px' },
  suggestionLabel: { display: 'block', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: '700' },
  suggestionChips: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  suggestionChip: { padding: '10px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: '700' },
  noResults: { textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--text-muted)' },
  resultCount: { marginBottom: 'var(--spacing-lg)', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', fontWeight: '700' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '22px' },
  gridMobile: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  card: { textDecoration: 'none', display: 'grid', gap: '12px' },
  posterWrapper: { position: 'relative', borderRadius: '24px', overflow: 'hidden', aspectRatio: '3/4', background: 'var(--bg-tertiary)', boxShadow: 'var(--shadow-card)' },
  poster: { width: '100%', height: '100%', objectFit: 'cover' },
  overlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.06) 10%, rgba(7,17,31,0.82) 100%)' },
  rank: { position: 'absolute', top: '14px', left: '14px', width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(7,17,31,0.76)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.76rem' },
  badge: { position: 'absolute', right: '14px', bottom: '14px', background: 'rgba(255,255,255,0.12)', color: 'var(--text-primary)', padding: '7px 10px', borderRadius: '999px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' },
  info: { padding: '12px 4px 0', display: 'grid', gap: '8px' },
  infoTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' },
  reviewBadge: { padding: '6px 8px', borderRadius: '999px', background: 'rgba(255,200,87,0.16)', color: 'var(--accent-amber)', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' },
  cardTitle: { fontSize: '1.12rem', color: 'var(--text-primary)' },
  cardMeta: { fontSize: '0.84rem', color: 'var(--text-muted)' },
  languageMeta: { fontSize: '0.8rem', color: 'var(--accent-cyan)' },
};

export default SearchPage;
