import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBreakpoint, useTVMode } from '../../../hooks';
import StarRating from '../../../components/ui/StarRating';
import WatchlistButton from '../../../components/ui/WatchlistButton';

const AUTO_PLAY_DURATION = 3200;
const AUTO_PLAY_RESUME_DELAY = 1200;
const PROGRESS_INTERVAL = 50;

function HeroCarousel({ content, items }) {
    const contentItems = Array.isArray(content) ? content : Array.isArray(items) ? items : [];
    const { isMobile, isTablet } = useBreakpoint();
    const isTVMode = useTVMode();
    const sectionRef = useRef(null);
    const bgRef = useRef(null);
    const resumeTimerRef = useRef(null);
    const touchStartRef = useRef(0);
    const touchEndRef = useRef(0);

    const [activeIndex, setActiveIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isAutoPlay, setIsAutoPlay] = useState(true);
    const [isHovering, setIsHovering] = useState(false);

    const scheduleAutoPlayResume = useCallback(() => {
        if (resumeTimerRef.current) {
            clearTimeout(resumeTimerRef.current);
        }

        setIsAutoPlay(false);
        resumeTimerRef.current = window.setTimeout(() => {
            setIsAutoPlay(true);
            setProgress(0);
        }, AUTO_PLAY_RESUME_DELAY);
    }, []);

    const moveToSlide = useCallback((index) => {
        if (contentItems.length === 0) return;
        const normalizedIndex = (index + contentItems.length) % contentItems.length;
        setActiveIndex(normalizedIndex);
        setProgress(0);
        scheduleAutoPlayResume();
    }, [contentItems.length, scheduleAutoPlayResume]);

    useEffect(() => {
        return () => {
            if (resumeTimerRef.current) {
                clearTimeout(resumeTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!contentItems.length) {
            setTimeout(() => setActiveIndex(0), 0);
            return;
        }
        setTimeout(() => setActiveIndex((prev) => Math.min(prev, contentItems.length - 1)), 0);
    }, [contentItems.length]);

    const previewItems = getPreviewItems(contentItems, activeIndex, 4);

    useEffect(() => {
        if (contentItems.length <= 1 || !isAutoPlay) return undefined;

        let elapsed = 0;
        const intervalId = window.setInterval(() => {
            elapsed += PROGRESS_INTERVAL;
            const nextProgress = Math.min((elapsed / AUTO_PLAY_DURATION) * 100, 100);
            setProgress(nextProgress);

            if (elapsed >= AUTO_PLAY_DURATION) {
                elapsed = 0;
                setProgress(0);
                setActiveIndex((prev) => (prev + 1) % contentItems.length);
            }
        }, PROGRESS_INTERVAL);

        return () => window.clearInterval(intervalId);
    }, [contentItems.length, isAutoPlay]);

    useEffect(() => {
        if (isMobile || isTablet) return undefined;

        const handleScroll = () => {
            if (!bgRef.current) return;
            const y = window.scrollY;
            bgRef.current.style.transform = `scale(1.08) translate3d(0, ${y * 0.12}px, 0)`;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMobile, isTablet]);


    useEffect(() => {
        const handleKeyDown = (event) => {
            const targetWithinHero = sectionRef.current?.contains(document.activeElement) || document.activeElement === document.body;
            if (!targetWithinHero || contentItems.length <= 1) return;

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveToSlide(activeIndex - 1);
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveToSlide(activeIndex + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeIndex, contentItems.length, moveToSlide]);

    const handleTouchStart = (event) => {
        touchStartRef.current = event.changedTouches[0].clientX;
    };

    const handleTouchEnd = (event) => {
        touchEndRef.current = event.changedTouches[0].clientX;
        const delta = touchStartRef.current - touchEndRef.current;

        if (Math.abs(delta) < 50) return;
        moveToSlide(activeIndex + (delta > 0 ? 1 : -1));
    };

    if (!contentItems.length) return null;

    const contentItem = contentItems[activeIndex];
    if (!contentItem) return null;

    const heroImage = contentItem.backdrop || contentItem.poster || '';
    const isSeries = contentItem.type === 'series';
    const isPlaceholder = Boolean(contentItem.isPlaceholder);
    const title = contentItem.title || 'Featured spotlight';
    const description = contentItem.description || 'Freshly highlighted content from your portal.';
    const eyebrow = isPlaceholder ? 'CURATED DROP' : isSeries ? 'SERIES SPOTLIGHT' : 'MOVIE PREMIERE';
    const heroChips = [contentItem.genre, contentItem.language, contentItem.year].filter(Boolean).slice(0, 3);
    const insightItems = [
        { label: 'Format', value: isPlaceholder ? 'Spotlight' : isSeries ? 'Series' : 'Movie' },
        { label: 'Rating', value: contentItem.rating || 'N/A', isRating: true },
        { label: 'Language', value: contentItem.language || 'Mixed' },
    ];

    return (
        <section
            ref={sectionRef}
            style={{
                ...styles.hero,
                ...(isTablet ? styles.heroTablet : {}),
                ...(isMobile ? styles.heroMobile : {}),
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label="Featured content carousel"
        >
            <div style={styles.background}>
                <div style={styles.bgFallback} />
                {heroImage ? (
                    <img
                        ref={bgRef}
                        src={heroImage}
                        alt={title}
                        style={styles.bgImage}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        sizes="100vw"
                    />
                ) : null}
                <div style={{ ...styles.auroraOrb, ...styles.orb1 }} />
                <div style={{ ...styles.auroraOrb, ...styles.orb2 }} />
                <div style={styles.backdropWash} />
                <div style={styles.overlay} />
                <div style={styles.bottomFade} />
            </div>

            <div style={{ 
                ...styles.layout, 
                ...(isTablet ? styles.layoutTablet : {}), 
                ...(isMobile ? styles.layoutMobile : {}),
                ...(isTVMode ? styles.layoutTV : {})
            }}>
                <div style={{ 
                    ...styles.copyPanel, 
                    ...(isMobile ? styles.copyPanelMobile : {}),
                    ...(isTVMode ? styles.copyPanelTV : {})
                }}>
                    <div style={styles.kickerRow}>
                        <span style={styles.liveBadge}>{eyebrow}</span>
                        {contentItem.genre ? <span style={styles.genre}>{contentItem.genre}</span> : null}
                        {contentItem.year ? <span style={styles.year}>{contentItem.year}</span> : null}
                    </div>

                    <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>{title}</h1>
                    <p style={{ ...styles.description, ...(isMobile ? styles.descriptionMobile : {}) }}>{description}</p>

                    <div style={styles.chipRow}>
                        {heroChips.map((chip) => (
                            <span key={chip} style={styles.heroChip}>{chip}</span>
                        ))}
                    </div>

                    <div style={{ ...styles.metricRow, ...(isMobile ? styles.metricRowMobile : {}) }}>
                        {insightItems.map((item) => (
                            <div key={item.label} style={{ ...styles.metricStat, ...(isMobile ? styles.metricStatMobile : {}) }}>
                                <span style={styles.metricLabel}>{item.label}</span>
                                {item.isRating && contentItem.rating ? (
                                    <StarRating rating={contentItem.rating} size="sm" showNumber />
                                ) : (
                                    <strong style={styles.metricValue}>{item.value}</strong>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ ...styles.actions, ...(isMobile ? styles.actionsMobile : {}) }}>
                        <Link to={isPlaceholder ? '/browse?sort=latest' : `/watch/${contentItem.id}`} style={{ ...styles.playBtn, ...(isMobile ? styles.playBtnMobile : {}) }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                                {isPlaceholder ? <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z" /> : <path d="M8 5v14l11-7z" />}
                            </svg>
                            <span>{isPlaceholder ? 'Browse Latest' : isSeries ? 'Start Watching' : 'Play Now'}</span>
                        </Link>

                        <Link to={isPlaceholder ? '/search' : isSeries ? `/series/${contentItem.id}` : `/movies/${contentItem.id}`} style={{ ...styles.infoBtn, ...(isMobile ? styles.infoBtnMobile : {}) }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.buttonIcon} aria-hidden="true">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                            </svg>
                            <span>{isPlaceholder ? 'Search Portal' : 'Details'}</span>
                        </Link>

                        {!isPlaceholder ? (
                            <div style={styles.watchlistWrap}>
                                <WatchlistButton contentType={isSeries ? 'series' : 'movie'} contentId={contentItem.id} title={title} />
                            </div>
                        ) : null}
                    </div>
                </div>

                {!isMobile && !isTVMode ? (
                    <div style={{ ...styles.showcasePanel, ...(isTablet ? styles.showcasePanelTablet : {}) }}>
                        <div style={styles.posterFrame}>
                            {contentItem.poster ? (
                                <img
                                    src={contentItem.poster}
                                    alt={title}
                                    style={styles.posterImage}
                                    loading="eager"
                                    fetchPriority="high"
                                    decoding="async"
                                />
                            ) : (
                                <div style={styles.posterPlaceholder} />
                            )}
                            <div style={styles.posterShine} />
                        </div>

                        <div style={styles.queueCard}>
                            <div style={styles.queueHeader}>
                                <span style={styles.queueLabel}>Up next</span>
                            </div>

                            <div style={styles.thumbnailRow}>
                                {previewItems.map(({ item, index }) => (
                                    <button
                                        key={item.id || index}
                                        onClick={() => moveToSlide(index)}
                                        style={{
                                            ...styles.thumbnailItem,
                                            ...(index === activeIndex ? styles.thumbnailItemActive : {}),
                                        }}
                                        aria-label={`Go to slide ${index + 1}`}
                                        aria-current={index === activeIndex ? 'true' : 'false'}
                                    >
                                        {item.poster ? <img src={item.poster} alt={item.title || `Slide ${index + 1}`} style={styles.thumbnailImage} loading="eager" fetchPriority="high" /> : <div style={styles.thumbnailPlaceholder} />}
                                        <div style={styles.thumbnailOverlay} />
                                        <span style={styles.thumbnailTitle}>{item.title || 'Featured item'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {contentItems.length > 1 ? (
                <>
                    {!isMobile ? (
                        <div style={{ ...styles.navigationArrows, opacity: isHovering ? 1 : 0.78 }}>
                            <button onClick={() => moveToSlide(activeIndex - 1)} style={styles.arrowBtn} aria-label="Previous slide" title="Previous (left arrow key)">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <button onClick={() => moveToSlide(activeIndex + 1)} style={styles.arrowBtn} aria-label="Next slide" title="Next (right arrow key)">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    ) : null}

                    <div style={styles.progressBarContainer}>
                        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
                    </div>

                    <div style={{ ...styles.carouselDots, ...(isMobile ? styles.carouselDotsMobile : {}) }}>
                        {contentItems.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => moveToSlide(index)}
                                style={index === activeIndex ? styles.dotActive : styles.dot}
                                aria-label={`Go to slide ${index + 1}`}
                                aria-current={index === activeIndex ? 'true' : 'false'}
                            />
                        ))}
                    </div>
                </>
            ) : null}
        </section>
    );
}

function getPreviewItems(items, activeIndex, size) {
    if (!Array.isArray(items) || items.length === 0) return [];

    return Array.from({ length: Math.min(size, items.length) }, (_, offset) => {
        const index = (activeIndex + offset) % items.length;
        return { item: items[index], index };
    });
}

const styles = {
    hero: {
        position: 'relative',
        zIndex: 3,
        height: 'clamp(640px, 85vh, 880px)',
        overflow: 'hidden',
        background: '#050c16',
        borderBottomLeftRadius: '48px',
        borderBottomRightRadius: '48px',
        marginBottom: '40px',
    },
    heroTablet: {
        height: 'clamp(540px, 70vh, 680px)',
    },
    heroMobile: {
        height: 'clamp(480px, 65svh, 600px)',
        borderBottomLeftRadius: '32px',
        borderBottomRightRadius: '32px',
        marginBottom: '24px',
    },
    background: {
        position: 'absolute',
        inset: 0,
        zIndex: 0,
    },
    bgFallback: {
        position: 'absolute',
        inset: 0,
        background: '#050c16',
    },
    bgImage: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center 15%',
        transform: 'scale(1.1)',
        filter: 'saturate(1.1) contrast(1.1)',
        transition: 'transform 8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    },
    auroraOrb: {
        position: 'absolute',
        width: '50vw',
        height: '50vw',
        borderRadius: '50%',
        filter: 'blur(100px)',
        opacity: 0.15,
        pointerEvents: 'none',
        zIndex: 1,
    },
    orb1: {
        top: '-10%',
        left: '-5%',
        background: 'radial-gradient(circle, var(--accent-cyan), transparent 70%)',
    },
    orb2: {
        bottom: '10%',
        right: '-10%',
        background: 'radial-gradient(circle, var(--accent-pink), transparent 70%)',
    },
    backdropWash: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(105deg, rgba(5,12,22,0.92) 15%, rgba(5,12,22,0.4) 45%, rgba(5,12,22,0.2) 65%, rgba(5,12,22,0.85) 100%)',
        zIndex: 2,
    },
    overlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(5,12,22,0.3) 0%, rgba(5,12,22,0.1) 30%, rgba(5,12,22,0.95) 100%)',
        zIndex: 3,
    },
    bottomFade: {
        position: 'absolute',
        inset: 'auto 0 0 0',
        height: '40%',
        background: 'linear-gradient(180deg, transparent 0%, #050c16 100%)',
        zIndex: 4,
    },
    layout: {
        position: 'relative',
        zIndex: 2,
        width: 'min(1440px, calc(100vw - 48px))',
        margin: '0 auto',
        height: 'calc(clamp(540px, 74vh, 760px) - var(--nav-occupied-desktop))',
        padding: 'clamp(24px, 4vw, 52px) 0 76px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 340px)',
        gap: '24px',
        alignItems: 'center',
    },
    layoutTablet: {
        width: 'min(100vw - 32px, 1200px)',
        height: 'calc(clamp(500px, 66vh, 640px) - var(--nav-occupied-desktop))',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: '18px',
        padding: '24px 0 72px',
    },
    layoutTV: {
        width: 'min(1720px, calc(100vw - 120px))',
        height: 'calc(80vh - var(--nav-occupied-desktop))',
        gridTemplateColumns: '1fr', /* Single column to focus on centered content */
        textAlign: 'center',
        justifyItems: 'center',
    },
    copyPanelTV: {
        maxWidth: '1200px',
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyPanelMobile: {
        padding: '0 16px',
    },
    kickerRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        marginBottom: '14px',
    },
    liveBadge: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        background: 'rgba(255, 0, 128, 0.15)',
        border: '1px solid rgba(255, 0, 128, 0.4)',
        color: 'var(--accent-pink)',
        fontSize: '0.75rem',
        fontWeight: '900',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
    },
    genre: {
        color: 'var(--accent-cyan)',
        fontSize: '0.85rem',
        fontWeight: '800',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
    },
    year: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '0.95rem',
    },
    title: {
        maxWidth: '12ch',
        marginBottom: '16px',
        color: '#ffffff',
        fontSize: 'clamp(3.2rem, 7vw, 6rem)',
        fontWeight: '900',
        lineHeight: '0.9',
        textShadow: '0 10px 40px rgba(0,0,0,0.6)',
        textWrap: 'balance',
    },
    titleMobile: {
        fontSize: 'clamp(2.4rem, 10vw, 3.4rem)',
        marginBottom: '12px',
        maxWidth: '12ch',
    },
    description: {
        maxWidth: '54ch',
        marginBottom: '18px',
        color: 'rgba(247, 243, 234, 0.84)',
        fontSize: '0.98rem',
        lineHeight: '1.65',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    descriptionMobile: {
        marginBottom: '14px',
        fontSize: '0.9rem',
        lineHeight: '1.55',
        WebkitLineClamp: 2,
    },
    chipRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '14px',
    },
    heroChip: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.5rem 0.9rem',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'var(--text-primary)',
        fontSize: '0.78rem',
        fontWeight: '700',
    },
    metricRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px',
    },
    metricRowMobile: {
        gap: '10px',
        marginBottom: '18px',
    },
    metricStat: {
        minWidth: '120px',
        padding: '12px 14px',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    },
    metricStatMobile: {
        flex: '1 1 calc(50% - 10px)',
        minWidth: '0',
        padding: '12px',
        borderRadius: '16px',
    },
    metricLabel: {
        display: 'block',
        marginBottom: '6px',
        color: 'var(--text-muted)',
        fontSize: '0.72rem',
        fontWeight: '700',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
    },
    metricValue: {
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontWeight: '700',
    },
    actions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
    },
    actionsMobile: {
        gap: '10px',
    },
    playBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        minWidth: '180px',
        padding: '16px 32px',
        borderRadius: '12px',
        color: '#050c16',
        background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-secondary))',
        fontWeight: '900',
        fontSize: '1rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
    },
    playBtnMobile: {
        flex: '1 1 auto',
        minWidth: '0',
        padding: '14px 20px',
        fontSize: '0.9rem',
    },
    infoBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        minWidth: '160px',
        padding: '16px 28px',
        borderRadius: '12px',
        color: '#ffffff',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(12px)',
        fontWeight: '700',
        fontSize: '0.95rem',
    },
    infoBtnMobile: {
        flex: '1 1 auto',
        minWidth: '0',
        padding: '14px 20px',
        fontSize: '0.9rem',
    },
    watchlistWrap: {
        display: 'inline-flex',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
    },
    buttonIcon: {
        flexShrink: 0,
    },
    showcasePanel: {
        justifySelf: 'end',
        width: '100%',
        maxWidth: '340px',
        minWidth: '340px',
        display: 'grid',
        gap: '14px',
    },
    showcasePanelTablet: {
        maxWidth: '280px',
        minWidth: '280px',
    },
    posterFrame: {
        position: 'relative',
        width: '100%',
        aspectRatio: '0.72',
        overflow: 'hidden',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.06)',
        boxShadow: '0 28px 70px rgba(0,0,0,0.38)',
    },
    posterImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    posterShine: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, transparent 24%, transparent 100%)',
        pointerEvents: 'none',
    },
    queueCard: {
        padding: '16px',
        borderRadius: '24px',
        background: 'rgba(5, 12, 22, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
    },
    queueHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    queueLabel: {
        color: 'var(--accent-cyan)',
        fontSize: '0.75rem',
        fontWeight: '900',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
    },
    thumbnailRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '10px',
    },
    thumbnailItem: {
        position: 'relative',
        aspectRatio: '2 / 3',
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        padding: 0,
        textAlign: 'left',
    },
    thumbnailItemActive: {
        borderColor: 'var(--accent-cyan)',
        boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
        transform: 'translateY(-4px)',
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
    },
    thumbnailOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.02) 24%, rgba(0,0,0,0.88) 100%)',
    },
    thumbnailTitle: {
        position: 'absolute',
        left: '10px',
        right: '10px',
        bottom: '10px',
        zIndex: 1,
        color: '#fff',
        fontSize: '0.7rem',
        fontWeight: '700',
        lineHeight: '1.3',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    navigationArrows: {
        position: 'absolute',
        right: 'max(24px, calc((100vw - min(1440px, calc(100vw - 48px))) / 2))',
        top: 'calc(var(--nav-occupied-desktop) + 10px)',
        zIndex: 3,
        display: 'flex',
        gap: '10px',
        transition: 'opacity 180ms ease',
    },
    arrowBtn: {
        width: '52px',
        height: '52px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        color: 'var(--text-primary)',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 14px 28px rgba(0,0,0,0.18)',
    },
    progressBarContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '3px',
        background: 'rgba(255,255,255,0.08)',
        zIndex: 3,
    },
    progressBar: {
        height: '100%',
        background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-secondary))',
        transition: 'width 50ms linear',
        boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)',
    },
    carouselDots: {
        position: 'absolute',
        left: '50%',
        bottom: '18px',
        transform: 'translateX(-50%)',
        zIndex: 3,
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 14px',
        borderRadius: '999px',
        background: 'rgba(7,17,31,0.52)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(14px)',
    },
    carouselDotsMobile: {
        bottom: '14px',
        gap: '8px',
        padding: '8px 10px',
    },
    dot: {
        width: '10px',
        height: '10px',
        padding: 0,
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.32)',
    },
    dotActive: {
        width: '30px',
        height: '10px',
        padding: 0,
        borderRadius: '999px',
        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
        boxShadow: '0 0 18px rgba(121, 228, 255, 0.22)',
    },
};

export default HeroCarousel;
