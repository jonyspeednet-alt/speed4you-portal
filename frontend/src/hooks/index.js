import { useState, useEffect, useRef } from 'react';

export function useDebouncedSearch(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState('desktop');
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = window.innerWidth;
      setWidth(nextWidth);
      if (nextWidth < 640) setBreakpoint('mobile');
      else if (nextWidth < 1024) setBreakpoint('tablet');
      else setBreakpoint('desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    breakpoint,
    width,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isSmallMobile: width < 420,
    isLargeDesktop: width >= 1440,
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
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

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
