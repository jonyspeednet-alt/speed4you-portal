/**
 * Custom hook for Hero Carousel configuration
 * Allows easy customization of carousel behavior and timing
 */
import React from 'react';

export const useCarouselConfig = (overrides = {}) => {
    const defaultConfig = {
        // Timing
        autoPlayDuration: 7000, // ms
        progressUpdateInterval: 50, // ms
        resumeAutoPlayDelay: 10000, // ms after user interaction

        // Behavior
        enableAutoPlay: true,
        enableKeyboardNavigation: true,
        enableTouchSwipe: true,
        enableParallax: true,

        // Swipe
        swipeThreshold: 50, // px

        // Display
        showProgressBar: true,
        showNavigationArrows: true,
        showDots: true,
        showSlideCounter: true,
        showThumbnails: true,
        maxThumbnails: 5,

        // Parallax
        parallaxStrength: 0.28,
        parallaxScale: 1.04,

        // Animation
        transitionDuration: 300, // ms
        imageAnimationDuration: 800, // ms
    };

    return { ...defaultConfig, ...overrides };
};

/**
 * Hook to manage carousel state and handlers
 */
export const useCarouselState = (contentItems = [], config = {}) => {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [isAutoPlay, setIsAutoPlay] = React.useState(config.enableAutoPlay ?? true);
    const [progress, setProgress] = React.useState(0);
    const [isHovering, setIsHovering] = React.useState(false);

    const handleNext = React.useCallback(() => {
        setActiveIndex((prev) => (prev + 1) % contentItems.length);
        setProgress(0);
        setIsAutoPlay(false);
        setTimeout(() => setIsAutoPlay(true), config.resumeAutoPlayDelay);
    }, [contentItems.length, config.resumeAutoPlayDelay]);

    const handlePrevious = React.useCallback(() => {
        setActiveIndex((prev) => (prev - 1 + contentItems.length) % contentItems.length);
        setProgress(0);
        setIsAutoPlay(false);
        setTimeout(() => setIsAutoPlay(true), config.resumeAutoPlayDelay);
    }, [contentItems.length, config.resumeAutoPlayDelay]);

    const handleDotClick = React.useCallback((index) => {
        setActiveIndex(index);
        setProgress(0);
        setIsAutoPlay(false);
        setTimeout(() => setIsAutoPlay(true), config.resumeAutoPlayDelay);
    }, [config.resumeAutoPlayDelay]);

    return {
        activeIndex,
        setActiveIndex,
        isAutoPlay,
        setIsAutoPlay,
        progress,
        setProgress,
        isHovering,
        setIsHovering,
        handleNext,
        handlePrevious,
        handleDotClick,
    };
};

/**
 * Hook for keyboard navigation
 */
export const useKeyboardNavigation = (enabled = true, onNext, onPrevious) => {
    React.useEffect(() => {
        if (!enabled) return;

        function handleKeyDown(e) {
            if (e.key === 'ArrowLeft') {
                onPrevious?.();
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                onNext?.();
                e.preventDefault();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onNext, onPrevious]);
};

/**
 * Hook for touch/swipe support
 */
export const useSwipeNavigation = (enabled = true, onNext, onPrevious, threshold = 50) => {
    const touchStartRef = React.useRef(0);
    const touchEndRef = React.useRef(0);

    const handleTouchStart = React.useCallback((e) => {
        if (!enabled) return;
        touchStartRef.current = e.changedTouches[0].clientX;
    }, [enabled]);

    const handleTouchEnd = React.useCallback((e) => {
        if (!enabled) return;
        touchEndRef.current = e.changedTouches[0].clientX;

        const diff = touchStartRef.current - touchEndRef.current;
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                onNext?.();
            } else {
                onPrevious?.();
            }
        }
    }, [enabled, onNext, onPrevious, threshold]);

    return { handleTouchStart, handleTouchEnd };
};

/**
 * Hook for parallax scroll effect
 */
export const useParallaxEffect = (enabled = true, strength = 0.28, scale = 1.04) => {
    const bgRef = React.useRef(null);

    React.useEffect(() => {
        if (!enabled || !bgRef.current) return;

        function onScroll() {
            if (!bgRef.current) return;
            const y = window.scrollY;
            bgRef.current.style.transform = `scale(${scale}) translateY(${y * strength}px)`;
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [enabled, strength, scale]);

    return bgRef;
};

/**
 * Hook for auto-play with progress tracking
 */
export const useAutoPlay = (
    enabled = true,
    duration = 7000,
    updateInterval = 50,
    onProgress,
    onComplete
) => {
    React.useEffect(() => {
        if (!enabled) return;

        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += updateInterval;
            const progress = (elapsed / duration) * 100;
            onProgress?.(progress);

            if (elapsed >= duration) {
                onComplete?.();
                elapsed = 0;
            }
        }, updateInterval);

        return () => clearInterval(interval);
    }, [enabled, duration, updateInterval, onProgress, onComplete]);
};

export default useCarouselConfig;
