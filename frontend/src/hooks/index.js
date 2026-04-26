import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebouncedSearch(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Breakpoint thresholds — keep in sync with global.css
const BREAKPOINTS = {
  SMALL_MOBILE: 420,
  MOBILE: 640,
  TABLET: 1024,
  LARGE_DESKTOP: 1440,
};

function getBreakpoint(w) {
  if (w < BREAKPOINTS.MOBILE) return 'mobile';
  if (w < BREAKPOINTS.TABLET) return 'tablet';
  return 'desktop';
}

export function useBreakpoint() {
  const initialWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const [width, setWidth] = useState(initialWidth);
  const rafRef = useRef(null);

  useEffect(() => {
    // Use ResizeObserver on the document element for better accuracy
    // Fall back to window resize event
    const handleResize = () => {
      // Debounce via requestAnimationFrame to avoid excessive re-renders
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
      });
    };

    // ResizeObserver is more accurate than window resize for viewport changes
    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize);
      observer.observe(document.documentElement);
    } else {
      window.addEventListener('resize', handleResize, { passive: true });
    }

    // Also listen for orientation change (important on mobile)
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', handleResize);
      }
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const breakpoint = getBreakpoint(width);

  return {
    breakpoint,
    width,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isSmallMobile: width < BREAKPOINTS.SMALL_MOBILE,
    isLargeDesktop: width >= BREAKPOINTS.LARGE_DESKTOP,
    // Convenience: touch-first devices
    isTouchDevice: breakpoint === 'mobile' || breakpoint === 'tablet',
  };
}

export function useHorizontalScroll() {
  const ref = useRef(null);

  const scroll = (direction) => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return { ref, scroll };
}

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    setStoredValue((previousValue) => {
      try {
        const valueToStore = value instanceof Function ? value(previousValue) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      } catch {
        return value instanceof Function ? value(previousValue) : value;
      }
    });
  }, [key]);

  return [storedValue, setValue];
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useLocalStorage('isp-watchlist', []);

  const addToWatchlist = (content) => {
    if (!watchlist.find(item => item.id === content.id)) {
      setWatchlist([...watchlist, { ...content, addedAt: new Date().toISOString() }]);
    }
  };

  const removeFromWatchlist = (id) => {
    setWatchlist(watchlist.filter(item => item.id !== id));
  };

  const isInWatchlist = (id) => watchlist.some(item => item.id === id);

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist };
}

export function useContinueWatching() {
  const [progress, setProgress] = useLocalStorage('isp-continue-watching', []);

  const updateProgress = (contentId, position, duration) => {
    const percent = Math.round((position / duration) * 100);
    const existing = progress.findIndex(p => p.id === contentId);

    if (existing >= 0) {
      const updated = [...progress];
      updated[existing] = { ...updated[existing], position, duration, percent, updatedAt: new Date().toISOString() };
      setProgress(updated);
    } else {
      setProgress([...progress, { id: contentId, position, duration, percent, updatedAt: new Date().toISOString() }]);
    }
  };

  const getProgress = (contentId) => progress.find(p => p.id === contentId);

  return { progress, updateProgress, getProgress };
}

export function usePlayerState() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return {
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    volume, setVolume,
    isMuted, setIsMuted,
    isFullscreen, setIsFullscreen,
  };
}

export function useContentFilters() {
  const [filters, setFilters] = useState({
    genre: 'All',
    language: 'All',
    year: 'All',
    sort: 'latest',
  });

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      genre: 'All',
      language: 'All',
      year: 'All',
      sort: 'latest',
    });
  };

  return { filters, updateFilter, resetFilters };
}

// Track recently viewed content (last 12 items, no duplicates)
export function useRecentlyViewed() {
  const [items, setItems] = useLocalStorage('isp-recently-viewed', []);

  const addItem = useCallback((item) => {
    if (!item?.id) return;
    setItems((prev) => {
      const filtered = (prev || []).filter((i) => String(i.id) !== String(item.id));
      return [{ ...item, viewedAt: new Date().toISOString() }, ...filtered].slice(0, 12);
    });
  }, [setItems]);

  const clearAll = useCallback(() => setItems([]), [setItems]);

  return { items: items || [], addItem, clearAll };
}
