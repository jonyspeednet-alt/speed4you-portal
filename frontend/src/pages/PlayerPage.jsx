import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { moviesService, playerService, progressService, seriesService } from '../services';
import { useBreakpoint } from '../hooks';

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];
const CONTROLS_HIDE_DELAY = 3200;
const RESUME_SAVE_INTERVAL = 5;
const PLAYER_API_BASE = (import.meta.env.VITE_API_URL || '/portal-api').replace(/\/$/, '');
const AUDIO_BOOST_LEVELS = [1, 1.3, 1.6, 2];

function Icon({ children, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function withPlayerApiBase(pathname) {
  if (!pathname) {
    return '';
  }

  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    return pathname;
  }

  return `${PLAYER_API_BASE}${pathname}`;
}

function normalizeDuration(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  if (numericValue <= 400) {
    return numericValue * 60;
  }

  return numericValue;
}

function isPlausibleMediaDuration(mediaDuration, expectedDuration) {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return false;
  }

  if (!Number.isFinite(expectedDuration) || expectedDuration <= 0) {
    return true;
  }

  const tooShortComparedToExpected = mediaDuration < expectedDuration * 0.35;
  const hugeAbsoluteGap = expectedDuration - mediaDuration > 15 * 60;

  return !(tooShortComparedToExpected && hugeAbsoluteGap);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hrs = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPositiveInt(value, fallback) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.floor(asNumber);
  }

  const match = String(value || '').match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

function PlayerPage() {
  const { isMobile } = useBreakpoint();
  const { contentId } = useParams();
  const [searchParams] = useSearchParams();
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastSavedPositionRef = useRef(0);
  const pendingResumeTimeRef = useRef(null);
  const pendingAutoplayRef = useRef(false);
  const audioContextRef = useRef(null);
  const mediaSourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const compressorNodeRef = useRef(null);
  const lastTapRef = useRef({ time: 0, x: 0 });
  const holdSpeedTimerRef = useRef(null);
  const holdSpeedPrevRateRef = useRef(1);
  const invisibleVideoCheckRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [audioBoostLevel, setAudioBoostLevel] = useState(1.6);
  const [isAudioBoostEnabled, setIsAudioBoostEnabled] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [streamMode, setStreamMode] = useState('direct');
  const [qualityLabel, setQualityLabel] = useState('Auto');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [hasOptimizedFallbacked, setHasOptimizedFallbacked] = useState(false);
  const streamUrlBaseRef = useRef('');
  const seasonNumber = toPositiveInt(searchParams.get('season'), 1);
  const episodeNumber = toPositiveInt(searchParams.get('episode'), 1);
  const hasEpisodeSelection = searchParams.has('season') || searchParams.has('episode');

  const inferredDuration = Number(content?.durationSeconds || 0) || normalizeDuration(content?.duration || content?.runtimeMinutes || content?.runtime || 0);
  const trustedMediaDuration = isPlausibleMediaDuration(mediaDuration, inferredDuration) ? mediaDuration : 0;
  const activeDuration = trustedMediaDuration || inferredDuration;
  const activeTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = activeDuration ? clamp((activeTime / activeDuration) * 100, 0, 100) : 0;
  const canUsePictureInPicture = typeof document !== 'undefined' && document.pictureInPictureEnabled;
  const bufferedPercent = (() => {
    const video = videoRef.current;

    if (!video || !activeDuration || !video.buffered?.length) {
      return 0;
    }

    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    return clamp((bufferedEnd / activeDuration) * 100, 0, 100);
  })();
  const bufferedAheadSeconds = (() => {
    const video = videoRef.current;
    if (!video || !video.buffered?.length) {
      return 0;
    }

    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    for (let i = 0; i < video.buffered.length; i += 1) {
      const start = video.buffered.start(i);
      const end = video.buffered.end(i);
      if (current >= start && current <= end) {
        return Math.max(0, end - current);
      }
    }
    return 0;
  })();
  const bufferHealth = bufferedAheadSeconds >= 40 ? 'Excellent' : bufferedAheadSeconds >= 18 ? 'Good' : bufferedAheadSeconds >= 8 ? 'Fair' : 'Low';

  const upgradeToOptimizedStream = useCallback((baseUrl) => {
    if (!baseUrl || !videoRef.current || hasOptimizedFallbacked) {
      return;
    }

    const currentVideo = videoRef.current;
    const wasPlaying = !currentVideo.paused && !currentVideo.ended;
    const resumeFrom = Number.isFinite(currentVideo.currentTime) ? currentVideo.currentTime : 0;
    const optimizedUrl = withPlayerApiBase(`${baseUrl}${baseUrl.includes('?') ? '&' : '?'}requireOptimized=1&_ts=${Date.now()}`);

    pendingResumeTimeRef.current = resumeFrom > 0 ? resumeFrom : null;
    pendingAutoplayRef.current = wasPlaying;
    setHasOptimizedFallbacked(true);
    setStreamMode('optimized');
    setStreamUrl(optimizedUrl);
    setStreamStatus('Trying optimized stream...');
  }, [hasOptimizedFallbacked]);

  const clearInvisibleVideoCheck = useCallback(() => {
    if (invisibleVideoCheckRef.current && typeof window !== 'undefined') {
      window.clearTimeout(invisibleVideoCheckRef.current);
      invisibleVideoCheckRef.current = null;
    }
  }, []);

  const getRenderedVideoFrameCount = useCallback((video) => {
    if (!video) {
      return 0;
    }

    if (typeof video.getVideoPlaybackQuality === 'function') {
      return Number(video.getVideoPlaybackQuality()?.totalVideoFrames || 0);
    }

    if (Number.isFinite(video.webkitDecodedFrameCount)) {
      return Number(video.webkitDecodedFrameCount);
    }

    return 0;
  }, []);

  const scheduleInvisibleVideoCheck = useCallback(() => {
    clearInvisibleVideoCheck();

    if (typeof window === 'undefined' || !isMobile || hasOptimizedFallbacked || streamMode === 'optimized' || !streamUrlBaseRef.current) {
      return;
    }

    invisibleVideoCheckRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        return;
      }

      const hasKnownDimensions = Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0;
      const renderedFrames = getRenderedVideoFrameCount(video);
      const playbackTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;

      if (playbackTime >= 1.5 && (!hasKnownDimensions || renderedFrames === 0)) {
        upgradeToOptimizedStream(streamUrlBaseRef.current);
      }
    }, 2200);
  }, [clearInvisibleVideoCheck, getRenderedVideoFrameCount, hasOptimizedFallbacked, isMobile, streamMode, upgradeToOptimizedStream]);

  useEffect(() => {
    let cancelled = false;


    async function loadPlayer() {
      try {
        setLoading(true);
        setError('');
        setMediaDuration(0);
        setCurrentTime(0);
        setScrubTime(0);
        setStreamStatus('');
        setStreamMode('direct');
        setQualityLabel('Auto');
        lastSavedPositionRef.current = 0;
        pendingResumeTimeRef.current = null;
        pendingAutoplayRef.current = false;

        let item;
        const shouldPreferSeries = hasEpisodeSelection;
        try {
          item = shouldPreferSeries
            ? await seriesService.getById(contentId)
            : await moviesService.getById(contentId);
        } catch {
          item = shouldPreferSeries
            ? await moviesService.getById(contentId)
            : await seriesService.getById(contentId);
        }

        const stream = await playerService.getStream(item.type, contentId, {
          season: seasonNumber,
          episode: episodeNumber,
        });

        if (!cancelled) {
          setContent({
            ...item,
            type: stream.type || item.type,
            durationSeconds: stream.episode?.durationSeconds || stream.durationSeconds || item.durationSeconds || 0,
            runtimeMinutes: stream.episode?.runtimeMinutes || stream.runtimeMinutes || item.runtimeMinutes || item.runtime || null,
            duration: stream.episode?.duration || item.duration || item.runtime || 0,
            runtime: stream.episode?.duration || item.runtime || item.duration || 0,
            season: stream.season?.number || seasonNumber,
            episode: stream.episode?.number || episodeNumber,
            episodeTitle: stream.episode?.title || '',
            description: stream.episode?.description || item.description || '',
          });
          const primarySource = stream.sources?.[0] || {};
          const normalizedBaseUrl = withPlayerApiBase(primarySource.url || '');
          streamUrlBaseRef.current = normalizedBaseUrl;
          setStreamUrl(normalizedBaseUrl);
          setStreamMode(primarySource.delivery || 'direct');
          setQualityLabel(String(primarySource.qualityLabel || primarySource.quality || primarySource.resolution || 'Auto'));

          if (primarySource.delivery && primarySource.delivery !== 'direct' && !primarySource.optimizedReady) {
            setStreamStatus('Optimizing stream...');

            (async () => {
              let ready = false;
              for (let attempt = 0; attempt < 40 && !cancelled; attempt += 1) {
                const prepare = await playerService.prepareStream(item.type, contentId, {
                  season: seasonNumber,
                  episode: episodeNumber,
                });

                if (prepare.ready) {
                  ready = true;
                  break;
                }

                await new Promise((resolve) => setTimeout(resolve, 3000));
              }

              if (!cancelled) {
                if (ready) {
                  upgradeToOptimizedStream(primarySource.url || '');
                } else {
                  setStreamStatus('Using fallback stream.');
                }
              }
            })().catch(() => {
              if (!cancelled) {
                setStreamStatus('Using fallback stream.');
              }
            });
          } else {
            setStreamStatus('');
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || 'Playback is unavailable right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPlayer();

    return () => {
      cancelled = true;
      clearInvisibleVideoCheck();
    };
  }, [clearInvisibleVideoCheck, contentId, episodeNumber, hasEpisodeSelection, seasonNumber, upgradeToOptimizedStream]);

  useEffect(() => {
    async function loadResume() {
      try {
        if (!content?.type) {
          return;
        }

        const saved = await progressService.getFor(content.type, contentId || 1);
        const lastPosition = Number(saved?.last_position || 0);

        if (lastPosition > 0 && videoRef.current) {
          videoRef.current.currentTime = lastPosition;
          setCurrentTime(lastPosition);
          setScrubTime(lastPosition);
          lastSavedPositionRef.current = lastPosition;
        }
      } catch {
        // Resume data is optional.
      }
    }

    loadResume();
  }, [content?.type, contentId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = isMuted;
      videoRef.current.playbackRate = playbackRate;
    }
  }, [isMuted, playbackRate, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof window === 'undefined') {
      return undefined;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return undefined;
    }

    let cancelled = false;

    async function setupAudioBoost() {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        if (!mediaSourceNodeRef.current) {
          mediaSourceNodeRef.current = audioContextRef.current.createMediaElementSource(video);
          compressorNodeRef.current = audioContextRef.current.createDynamicsCompressor();
          compressorNodeRef.current.threshold.value = -24;
          compressorNodeRef.current.knee.value = 18;
          compressorNodeRef.current.ratio.value = 3;
          compressorNodeRef.current.attack.value = 0.003;
          compressorNodeRef.current.release.value = 0.25;

          gainNodeRef.current = audioContextRef.current.createGain();

          mediaSourceNodeRef.current.connect(compressorNodeRef.current);
          compressorNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }

        gainNodeRef.current.gain.value = isAudioBoostEnabled ? audioBoostLevel : 1;

        if (!cancelled && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume().catch(() => { });
        }
      } catch {
        // Audio boost is optional and should not block playback.
      }
    }

    setupAudioBoost();

    return () => {
      cancelled = true;
    };
  }, [audioBoostLevel, isAudioBoostEnabled, streamUrl]);

  useEffect(() => () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
      mediaSourceNodeRef.current = null;
      gainNodeRef.current = null;
      compressorNodeRef.current = null;
    }
  }, []);

  useEffect(() => {
    function scheduleHide() {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!isScrubbing && isPlaying) {
          setShowControls(false);
        }
      }, CONTROLS_HIDE_DELAY);
    }

    if (showControls && isPlaying) {
      scheduleHide();
    }

    return () => clearTimeout(hideTimerRef.current);
  }, [isPlaying, isScrubbing, showControls]);

  const persistProgress = useCallback(async (position, duration) => {
    if (!content?.type || !contentId || !Number.isFinite(position) || position <= 0) {
      return;
    }

    if (Math.abs(position - lastSavedPositionRef.current) < RESUME_SAVE_INTERVAL) {
      return;
    }

    lastSavedPositionRef.current = position;

    try {
      await progressService.update(content.type, contentId, Math.floor(position), Math.floor(duration || activeDuration || position));
    } catch {
      // Progress save should not interrupt playback.
    }
  }, [activeDuration, content?.type, contentId]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    function onPictureInPictureChange() {
      setIsPictureInPicture(Boolean(document.pictureInPictureElement));
    }

    function onKeyDown(event) {
      if (!videoRef.current) {
        return;
      }

      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.key === ' ') {
        event.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      } else if (event.key === 'ArrowRight' || key === 'l') {
        event.preventDefault();
        const duration = videoRef.current.duration || activeDuration || 0;
        const nextTime = clamp(videoRef.current.currentTime + 10, 0, duration || videoRef.current.currentTime + 10);
        videoRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
        setScrubTime(nextTime);
        persistProgress(nextTime, duration);
      } else if (event.key === 'ArrowLeft' || key === 'j') {
        event.preventDefault();
        const duration = videoRef.current.duration || activeDuration || 0;
        const nextTime = clamp(videoRef.current.currentTime - 10, 0, duration || videoRef.current.currentTime);
        videoRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
        setScrubTime(nextTime);
        persistProgress(nextTime, duration);
      } else if (key === 'm') {
        event.preventDefault();
        setIsMuted((current) => !current);
      } else if (key === 'f') {
        event.preventDefault();
        if (!document.fullscreenElement) {
          videoRef.current?.requestFullscreen?.();
        } else {
          document.exitFullscreen();
        }
      } else if (key === 'k') {
        event.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('enterpictureinpicture', onPictureInPictureChange);
    document.addEventListener('leavepictureinpicture', onPictureInPictureChange);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('enterpictureinpicture', onPictureInPictureChange);
      document.removeEventListener('leavepictureinpicture', onPictureInPictureChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeDuration, content?.type, contentId, persistProgress]);

  const handleMouseMove = () => {
    setShowControls(true);
  };

  const startHoldSpeedBoost = () => {
    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
    }
    holdSpeedPrevRateRef.current = playbackRate;
    holdSpeedTimerRef.current = setTimeout(() => {
      setPlaybackRate(2);
    }, 220);
  };

  const endHoldSpeedBoost = () => {
    if (holdSpeedTimerRef.current) {
      clearTimeout(holdSpeedTimerRef.current);
      holdSpeedTimerRef.current = null;
    }
    if (playbackRate === 2 && holdSpeedPrevRateRef.current !== 2) {
      setPlaybackRate(holdSpeedPrevRateRef.current);
    }
  };

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const togglePlayback = () => {
    if (!videoRef.current) {
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      return;
    }

    videoRef.current.pause();
    setIsPlaying(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen();
    }
  };

  const skipBy = (seconds) => {
    if (!videoRef.current) {
      return;
    }

    const duration = videoRef.current.duration || activeDuration || 0;
    const nextTime = clamp(videoRef.current.currentTime + seconds, 0, duration || videoRef.current.currentTime + seconds);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    setScrubTime(nextTime);
    persistProgress(nextTime, duration);
  };

  const commitScrub = (nextPosition) => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.currentTime = nextPosition;
    setCurrentTime(nextPosition);
    setScrubTime(nextPosition);
    persistProgress(nextPosition, activeDuration);
  };

  const handleScrubStart = () => {
    setIsScrubbing(true);
    setShowControls(true);
  };

  const handleScrubChange = (event) => {
    const nextPosition = Number(event.target.value);
    setScrubTime(nextPosition);

    if (isScrubbing) {
      commitScrub(nextPosition);
    }
  };

  const handleScrubEnd = (event) => {
    const nextPosition = Number(event.target.value);
    setIsScrubbing(false);
    commitScrub(nextPosition);
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current || !document.pictureInPictureEnabled) {
      return;
    }

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      setIsPictureInPicture(false);
      return;
    }

    await videoRef.current.requestPictureInPicture();
    setIsPictureInPicture(true);
  };

  const handleSurfaceTouchEnd = (event) => {
    if (!videoRef.current) {
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }

    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const timeGap = now - lastTapRef.current.time;
    const xGap = Math.abs(x - lastTapRef.current.x);

    if (timeGap < 280 && xGap < 72) {
      const isLeftZone = x < rect.width * 0.35;
      const isRightZone = x > rect.width * 0.65;
      if (isLeftZone) {
        skipBy(-10);
      } else if (isRightZone) {
        skipBy(10);
      } else {
        togglePlayback();
      }
      lastTapRef.current = { time: 0, x: 0 };
      return;
    }

    lastTapRef.current = { time: now, x };
  };

  if (loading) {
    return (
      <div style={styles.state}>
        <div style={styles.playerSkeleton}>
          <div style={{ ...styles.skeletonLine, width: '180px', height: '12px', marginBottom: '18px' }} />
          <div style={{ ...styles.skeletonLine, width: '42%', height: '40px', marginBottom: '14px' }} />
          <div style={{ ...styles.skeletonLine, width: '34%', height: '16px', marginBottom: '18px' }} />
          <div style={styles.skeletonVideoFrame} />
          <div style={{ ...styles.skeletonLine, width: '100%', height: '8px', marginTop: '18px', marginBottom: '16px' }} />
          <div style={styles.skeletonControlRow}>
            <div style={{ ...styles.skeletonPill, width: '96px' }} />
            <div style={{ ...styles.skeletonPill, width: '112px' }} />
            <div style={{ ...styles.skeletonPill, width: '88px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !content || !streamUrl) {
    return (
      <div style={styles.state}>
        <div style={styles.stateCard}>
          <h1 style={styles.stateTitle}>Player unavailable</h1>
          <p style={styles.stateText}>{error || 'No playable source found for this title.'}</p>
          <Link to="/" style={styles.backToPortal}>Back to portal</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, cursor: showControls ? 'default' : 'none' }} onMouseMove={handleMouseMove}>
      <video
        ref={videoRef}
        src={streamUrl}
        style={styles.video}
        autoPlay
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onPlay={() => {
          setIsPlaying(true);
          scheduleInvisibleVideoCheck();
        }}
        onPause={() => {
          setIsPlaying(false);
          clearInvisibleVideoCheck();
        }}
        onTimeUpdate={(event) => {
          const nextTime = event.target.currentTime;
          const nextDuration = Number.isFinite(event.target.duration) ? event.target.duration : activeDuration;

          setCurrentTime(nextTime);
          if (!isScrubbing) {
            setScrubTime(nextTime);
          }

          if (isPlausibleMediaDuration(nextDuration, inferredDuration)) {
            setMediaDuration(nextDuration);
          }

          persistProgress(nextTime, nextDuration);
        }}
        onDurationChange={(event) => {
          if (isPlausibleMediaDuration(event.target.duration, inferredDuration)) {
            setMediaDuration(event.target.duration);
            setContent((current) => ({
              ...current,
              durationSeconds: event.target.duration,
              duration: event.target.duration,
            }));
          }
        }}
        onLoadedMetadata={(event) => {
          if (pendingResumeTimeRef.current !== null) {
            event.target.currentTime = pendingResumeTimeRef.current;
            setCurrentTime(pendingResumeTimeRef.current);
            setScrubTime(pendingResumeTimeRef.current);
            pendingResumeTimeRef.current = null;
          }

          if (pendingAutoplayRef.current) {
            pendingAutoplayRef.current = false;
            event.target.play().catch(() => { });
          }

          if (isPlausibleMediaDuration(event.target.duration, inferredDuration)) {
            setMediaDuration(event.target.duration);
            setContent((current) => ({
              ...current,
              durationSeconds: event.target.duration,
              duration: event.target.duration,
            }));
          }

          // If video has no dimensions after metadata loads, try optimized stream.
          // Do this after setting duration so progress tracking still works.
          if ((event.target.videoWidth === 0 || event.target.videoHeight === 0) && streamMode !== 'optimized' && streamUrlBaseRef.current) {
            upgradeToOptimizedStream(streamUrlBaseRef.current);
          }
        }}
        onLoadedData={scheduleInvisibleVideoCheck}
        onPlaying={scheduleInvisibleVideoCheck}
        onWaiting={clearInvisibleVideoCheck}
        onSeeking={clearInvisibleVideoCheck}
        onEnded={() => {
          clearInvisibleVideoCheck();
          progressService.markComplete(content.type, contentId || 1);
        }}
        onError={() => {
          clearInvisibleVideoCheck();
          if (streamMode !== 'optimized' && streamUrlBaseRef.current) {
            upgradeToOptimizedStream(streamUrlBaseRef.current);
            return;
          }

          setError('The video source could not be loaded.');
        }}
      />

      <div
        style={styles.gestureSurface}
        onClick={() => setShowControls((c) => !c)}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          if (x < rect.width * 0.35) {
            skipBy(-10);
          } else if (x > rect.width * 0.65) {
            skipBy(10);
          } else {
            togglePlayback();
          }
        }}
        onTouchEnd={handleSurfaceTouchEnd}
      />

      <div style={{ ...styles.chrome, ...(isMobile ? styles.chromeMobile : {}) }} />
      <div style={{ ...styles.vignette, ...(isMobile ? styles.vignetteMobile : {}) }} />

      {!isMobile && (
        <Link to="/" style={{ ...styles.back, opacity: showControls ? 1 : 0 }}>
          Back
        </Link>
      )}

      {!isMobile && (
        <div style={{ ...styles.topInfo, opacity: showControls ? 1 : 0 }}>
          <h1 style={styles.title}>{content.title}</h1>
          <p style={styles.episode}>
            {content.type === 'series'
              ? `S${content.season} E${content.episode}${content.episodeTitle ? ` - ${content.episodeTitle}` : ''}`
              : (content.episodeTitle || 'Movie')}
          </p>
          {streamStatus ? <p style={styles.streamStatus}>{streamStatus}</p> : null}
          {streamMode === 'optimized' ? <p style={styles.streamHint}>Optimized</p> : null}
        </div>
      )}

      {/* ── Desktop controls panel ── */}
      {!isMobile && (
        <div
          style={{
            ...styles.controls,
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          {/* Scrubber */}
          <div style={styles.scrubberWrap}>
            <div style={styles.scrubberTrack}>
              <div style={{ ...styles.bufferedTrack, width: `${bufferedPercent}%` }} />
              <div style={{ ...styles.progressTrack, width: `${progressPercent}%` }} />
            </div>
            <input
              type="range" min="0" max={Math.max(0, activeDuration)} step="0.1"
              value={Math.min(activeTime, Math.max(0, activeDuration))}
              onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}
              onInput={handleScrubChange} onChange={handleScrubEnd}
              style={styles.scrubber}
            />
          </div>

          {/* Controls row */}
          <div style={styles.controlsRow}>
            <div style={styles.primaryCluster}>
              <div style={styles.playbackActions}>
                <button style={styles.pillControl} onClick={() => skipBy(-10)} aria-label="Back 10 seconds">
                  <Icon size={16}><path d="M11 19L2 12l9-7v14z" /><path d="M22 19l-9-7 9-7v14z" /></Icon>
                </button>
                <button style={styles.heroControl} onClick={togglePlayback}
                  onMouseDown={startHoldSpeedBoost} onMouseUp={endHoldSpeedBoost}
                  onMouseLeave={endHoldSpeedBoost} onTouchStart={startHoldSpeedBoost} onTouchEnd={endHoldSpeedBoost}
                >
                  {isPlaying
                    ? <Icon size={18}><line x1="10" y1="6" x2="10" y2="18" /><line x1="14" y1="6" x2="14" y2="18" /></Icon>
                    : <Icon size={18}><polygon points="8 5 19 12 8 19 8 5" /></Icon>}
                </button>
                <button style={styles.pillControl} onClick={() => skipBy(10)} aria-label="Skip 10 seconds">
                  <Icon size={16}><path d="M13 19l9-7-9-7v14z" /><path d="M2 19l9-7-9-7v14z" /></Icon>
                </button>
              </div>
              <div style={styles.timeGroup}>
                <span style={styles.timeStrong}>{formatTime(activeTime)}</span>
                <span style={styles.time}>/ {formatTime(activeDuration)}</span>
              </div>
              <div style={styles.metaBadge}>{content.type === 'series' ? `S${content.season} E${content.episode}` : 'MOVIE'}</div>
              <div style={styles.metaBadge}>{playbackRate}x</div>
              <div style={styles.metaBadge}>{qualityLabel}</div>
              <div style={styles.metaBadge}>{bufferHealth}</div>
            </div>
            <div style={styles.controlGroup}>
              <div style={styles.volumeControl}>
                <button style={styles.secondaryControl} onClick={() => setIsMuted((c) => !c)}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <input type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} style={styles.volumeSlider} />
              </div>
              <button style={styles.secondaryControl} onClick={() => setIsAudioBoostEnabled((c) => !c)}>
                {isAudioBoostEnabled ? 'Audio Boost' : 'Boost Off'}
              </button>
              <select value={String(audioBoostLevel)} onChange={(e) => setAudioBoostLevel(Number(e.target.value))} style={styles.select}>
                {AUDIO_BOOST_LEVELS.map((l) => <option key={l} value={l}>Audio {l.toFixed(1)}x</option>)}
              </select>
              <select value={String(playbackRate)} onChange={(e) => setPlaybackRate(Number(e.target.value))} style={styles.select}>
                {PLAYBACK_RATES.map((r) => <option key={r} value={r}>Speed {r}x</option>)}
              </select>
              {canUsePictureInPicture && (
                <button style={styles.secondaryControl} onClick={togglePictureInPicture}>
                  {isPictureInPicture ? 'PiP Off' : 'PiP'}
                </button>
              )}
              <button style={styles.secondaryControl} onClick={toggleFullscreen}>
                {isFullscreen ? 'Exit Full' : 'Full'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MOBILE — Netflix / YouTube style overlay controls
          Pinned to bottom, overlays the video directly.
      ══════════════════════════════════════════════════════ */}
      {isMobile && (
        <div
          style={{
            ...styles.mobilePlayerStack,
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
            transition: 'opacity 200ms ease',
          }}
        >
          {/* 1. Top bar: back + title */}
          <div style={styles.mobileTopBar}>
            <Link to="/" style={styles.mobileBackBtn} aria-label="Back to portal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              <span>Back</span>
            </Link>
            <div style={styles.mobileTitleGroup}>
              <span style={styles.mobileTitleText}>{content.title}</span>
              {content.type === 'series' && (
                <span style={styles.mobileEpisodeText}>
                  S{content.season} E{content.episode}{content.episodeTitle ? ` · ${content.episodeTitle}` : ''}
                </span>
              )}
              {streamStatus ? <span style={styles.mobileStreamStatus}>{streamStatus}</span> : null}
            </div>
          </div>

          {/* 2. Center play / skip buttons */}
          <div style={styles.mobileCenterControls}>
            <button style={styles.mobileGhostControl} onClick={() => skipBy(-10)} aria-label="Rewind 10 seconds">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                <path d="M11 19L2 12l9-7v14z" /><path d="M22 19l-9-7 9-7v14z" />
              </svg>
              <span style={styles.mobileSkipLabel}>-10</span>
            </button>

            <button
              style={styles.mobilePlayControl}
              onClick={togglePlayback}
              onMouseDown={startHoldSpeedBoost} onMouseUp={endHoldSpeedBoost}
              onMouseLeave={endHoldSpeedBoost} onTouchStart={startHoldSpeedBoost} onTouchEnd={endHoldSpeedBoost}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><polygon points="8 5 19 12 8 19 8 5" /></svg>
              }
            </button>

            <button style={styles.mobileGhostControl} onClick={() => skipBy(10)} aria-label="Skip 10 seconds">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                <path d="M13 19l9-7-9-7v14z" /><path d="M2 19l9-7-9-7v14z" />
              </svg>
              <span style={styles.mobileSkipLabel}>+10</span>
            </button>
          </div>

          {/* 3. Scrubber + time */}
          <div style={styles.mobileScrubRow}>
            <div style={styles.mobileScrubberWrap}>
              <div style={styles.mobileScrubberTrack}>
                <div style={{ ...styles.mobileBufferedTrack, width: `${bufferedPercent}%` }} />
                <div style={{ ...styles.mobileProgressTrack, width: `${progressPercent}%` }} />
              </div>
              <input
                type="range" min="0" max={Math.max(0, activeDuration)} step="0.1"
                value={Math.min(activeTime, Math.max(0, activeDuration))}
                onMouseDown={handleScrubStart} onTouchStart={handleScrubStart}
                onInput={handleScrubChange} onChange={handleScrubEnd}
                style={styles.mobileScrubber}
              />
            </div>
            <div style={styles.mobileTimeRow}>
              <span style={styles.mobileTimeText}>{formatTime(activeTime)}</span>
              <span style={styles.mobileTimeText}>{formatTime(activeDuration)}</span>
            </div>
          </div>

          {/* 4. Secondary action row */}
          <div style={styles.mobileActionRow}>
            {/* Mute */}
            <button style={styles.mobileActionBtn} onClick={() => setIsMuted((c) => !c)} aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0017.73 18L19 19.27 20.27 18 5.27 3 4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
              }
              <span style={styles.mobileActionLabel}>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Fullscreen */}
            <button style={styles.mobileActionBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              }
              <span style={styles.mobileActionLabel}>{isFullscreen ? 'Exit' : 'Full'}</span>
            </button>

            {/* Speed */}
            <label style={styles.mobileActionBtn} aria-label="Playback speed">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M10 8v8l6-4-6-4zm6.5-4.5C14.8 2.2 12.5 1.5 10 1.5 5.3 1.5 1.5 5.3 1.5 10S5.3 18.5 10 18.5c4.7 0 8.5-3.8 8.5-8.5 0-1.3-.3-2.5-.8-3.6l-1.2 1.2c.3.8.5 1.6.5 2.4 0 3.9-3.1 7-7 7s-7-3.1-7-7 3.1-7 7-7c1.4 0 2.7.4 3.8 1.1l1.2-1.1z" />
              </svg>
              <span style={styles.mobileActionLabel}>{playbackRate}x</span>
              <select value={String(playbackRate)} onChange={(e) => setPlaybackRate(Number(e.target.value))} style={styles.mobileHiddenSelect} aria-label="Select playback speed">
                {PLAYBACK_RATES.map((r) => <option key={r} value={r}>{r}x</option>)}
              </select>
            </label>

            {/* Audio Boost */}
            <button
              style={{ ...styles.mobileActionBtn, ...(isAudioBoostEnabled ? styles.mobileActionBtnActive : {}) }}
              onClick={() => setIsAudioBoostEnabled((c) => !c)}
              aria-label={isAudioBoostEnabled ? 'Disable audio boost' : 'Enable audio boost'}
              aria-pressed={isAudioBoostEnabled}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
              </svg>
              <span style={styles.mobileActionLabel}>Boost</span>
            </button>

            {/* PiP */}
            {canUsePictureInPicture && (
              <button style={styles.mobileActionBtn} onClick={togglePictureInPicture} aria-label={isPictureInPicture ? 'Exit PiP' : 'Picture in picture'}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M19 7h-8v6h8V7zm2-4H3C1.9 3 1 3.9 1 5v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
                </svg>
                <span style={styles.mobileActionLabel}>PiP</span>
              </button>
            )}
          </div>

          {/* 5. Meta badges */}
          <div style={styles.mobileMetaRow}>
            <div style={styles.metaBadge}>{content.type === 'series' ? `S${content.season}E${content.episode}` : 'MOVIE'}</div>
            <div style={styles.metaBadge}>{qualityLabel}</div>
            <div style={styles.metaBadge}>{bufferHealth}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  state: { minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '120px 24px 24px', background: '#050b14', color: '#fff' },
  playerSkeleton: { width: 'min(1200px, 100%)', padding: '24px' },
  skeletonVideoFrame: { width: '100%', aspectRatio: '16 / 9', borderRadius: '28px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.11), rgba(255,255,255,0.05))', backgroundSize: '200% 100%', animation: 'shimmer 1.2s linear infinite' },
  skeletonLine: { borderRadius: '999px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.11), rgba(255,255,255,0.05))', backgroundSize: '200% 100%', animation: 'shimmer 1.2s linear infinite' },
  skeletonControlRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  skeletonPill: { height: '42px', borderRadius: '999px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.11), rgba(255,255,255,0.05))', backgroundSize: '200% 100%', animation: 'shimmer 1.2s linear infinite' },
  stateCard: { maxWidth: '520px', padding: '32px', borderRadius: '28px', background: 'rgba(7,17,31,0.82)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' },
  stateTitle: { color: '#fff', marginBottom: '12px' },
  stateText: { color: 'rgba(255,255,255,0.72)', lineHeight: 1.7 },
  backToPortal: { display: 'inline-flex', marginTop: '20px', padding: '12px 18px', borderRadius: '999px', background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)', color: '#fff', fontWeight: '700' },
  page: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 2000, overflow: 'hidden' },
  video: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'block', objectFit: 'contain', backgroundColor: '#000', zIndex: 1,
    transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
  },
  gestureSurface: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4, background: 'transparent' },

  /* gradient overlays */
  chrome: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 22%, transparent 60%, rgba(0,0,0,0.88) 100%)',
    pointerEvents: 'none',
  },
  chromeMobile: { background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 18%, transparent 55%, rgba(0,0,0,0.92) 100%)' },
  vignette: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, background: 'radial-gradient(circle at center, transparent 48%, rgba(0,0,0,0.46) 100%)', pointerEvents: 'none' },
  vignetteMobile: { background: 'none' },

  /* desktop back / top info */
  back: { position: 'absolute', top: '24px', left: '24px', zIndex: 10, color: '#fff', padding: '10px 14px', borderRadius: '10px', background: 'rgba(10,14,20,0.82)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', fontWeight: '700', transition: 'opacity 180ms ease' },
  topInfo: { position: 'absolute', top: '24px', right: '24px', zIndex: 10, maxWidth: '560px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(10,14,20,0.78)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', transition: 'opacity 180ms ease' },
  title: { color: '#fff', fontSize: 'clamp(1.05rem, 2.2vw, 1.35rem)', marginBottom: '4px', lineHeight: 1.25 },
  episode: { color: 'rgba(255,255,255,0.78)', fontSize: '0.86rem', lineHeight: 1.4 },
  streamStatus: { marginTop: '6px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.4, fontSize: '0.78rem' },
  streamHint: { marginTop: '4px', color: 'rgba(119,222,255,0.95)', lineHeight: 1.4, fontWeight: '700', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.1em' },

  /* desktop controls container */
  controls: {
    position: 'absolute', left: '20px', right: '20px', bottom: '18px', zIndex: 10,
    padding: '12px 14px', borderRadius: '12px',
    background: 'rgba(10,14,20,0.84)', border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 16px 44px rgba(0,0,0,0.3)', transition: 'opacity 200ms ease',
  },
  /* mobile: transparent, full-width, pinned bottom — overlay on video */
  controlsMobile: {
    left: 0, right: 0, bottom: 0, borderRadius: 0,
    padding: 0, background: 'transparent', border: 'none',
    backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none',
  },

  /* desktop scrubber */
  scrubberWrap: { position: 'relative', marginBottom: '12px', height: '20px', display: 'flex', alignItems: 'center' },
  scrubberTrack: { position: 'absolute', left: 0, right: 0, height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  bufferedTrack: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.28)' },
  progressTrack: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: '999px', background: '#e50914' },
  scrubber: { position: 'relative', width: '100%', margin: 0, appearance: 'none', background: 'transparent', cursor: 'pointer', height: '20px' },

  /* desktop control rows */
  controlsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' },
  primaryCluster: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  playbackActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
  timeGroup: { display: 'inline-flex', alignItems: 'baseline', gap: '4px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)' },
  timeStrong: { color: '#fff', fontSize: '1rem', fontFamily: 'monospace', fontWeight: '700' },
  time: { color: 'rgba(255,255,255,0.72)', fontSize: '0.92rem', fontFamily: 'monospace' },
  metaBadge: { padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '700' },
  volumeControl: { display: 'flex', alignItems: 'center', gap: '10px' },
  secondaryControl: { minHeight: '40px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontWeight: '700' },
  volumeSlider: { width: '112px', accentColor: '#e50914' },
  select: { minHeight: '40px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' },
  heroControl: { minWidth: '62px', padding: '10px 12px', borderRadius: '10px', background: '#fff', color: '#0b1220', fontWeight: '900', fontFamily: 'monospace' },
  pillControl: { minWidth: '58px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontWeight: '800', fontFamily: 'monospace' },

  /* ══════════════════════════════════════════════════════════
     MOBILE — Netflix / YouTube style overlay
  ══════════════════════════════════════════════════════════ */

  /* Full-width gradient panel pinned to bottom, overlays video */
  mobilePlayerStack: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 55%, transparent 100%)',
    display: 'flex', flexDirection: 'column',
  },

  /* top bar: back + title + time */
  mobileTopBar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '14px 16px 6px',
  },
  mobileBackBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 12px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff', fontWeight: '700', fontSize: '0.86rem',
    minHeight: '40px', flexShrink: 0,
  },
  mobileTitleGroup: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: '2px',
    overflow: 'hidden', padding: '0 6px',
  },
  mobileTitleText: {
    color: '#fff', fontSize: '0.9rem', fontWeight: '700',
    lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  mobileEpisodeText: {
    color: 'rgba(255,255,255,0.6)', fontSize: '0.74rem',
    lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  mobileStreamStatus: { color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', lineHeight: 1.2 },

  /* center play / skip */
  mobileCenterControls: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '28px', padding: '10px 16px 14px',
  },
  mobilePlayControl: {
    width: '68px', height: '68px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.55)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  mobileGhostControl: {
    width: '54px', height: '54px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.28)',
    color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '3px', flexShrink: 0,
  },
  mobileSkipLabel: {
    fontSize: '0.64rem', fontWeight: '800', letterSpacing: '0.04em',
    color: 'rgba(255,255,255,0.85)',
  },

  /* scrubber + time */
  mobileScrubRow: { padding: '0 16px 4px' },
  mobileScrubberWrap: {
    position: 'relative', height: '20px', display: 'flex', alignItems: 'center',
    marginBottom: '4px',
  },
  mobileScrubberTrack: {
    position: 'absolute', left: 0, right: 0, height: '3px',
    borderRadius: '999px', background: 'rgba(255,255,255,0.28)', overflow: 'hidden',
  },
  mobileBufferedTrack: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderRadius: '999px', background: 'rgba(255,255,255,0.4)',
  },
  mobileProgressTrack: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderRadius: '999px', background: '#e50914',
  },
  mobileScrubber: {
    position: 'relative', width: '100%', margin: 0,
    appearance: 'none', background: 'transparent', cursor: 'pointer', height: '20px',
  },
  mobileTimeRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px',
  },
  mobileTimeText: {
    color: 'rgba(255,255,255,0.88)', fontSize: '0.78rem',
    fontFamily: 'monospace', fontWeight: '600',
  },

  /* secondary action row */
  mobileActionRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '8px 10px 12px', gap: '4px',
  },
  mobileActionBtn: {
    position: 'relative', flex: 1,
    minWidth: '48px', minHeight: '52px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '4px',
    padding: '6px 4px', overflow: 'hidden',
  },
  mobileActionBtnActive: {
    background: 'rgba(229,9,20,0.2)', borderColor: 'rgba(229,9,20,0.45)', color: '#ff6b6b',
  },
  mobileActionLabel: {
    fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'rgba(255,255,255,0.72)', lineHeight: 1,
  },
  mobileHiddenSelect: {
    position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer',
  },

  /* meta badges */
  mobileMetaRow: { display: 'flex', gap: '6px', padding: '0 16px 8px', flexWrap: 'wrap' },

  /* legacy stubs */
  mobileSecondaryRow: { display: 'none' },
  mobileSelectWrap: { display: 'none' },
  mobileSelectLabel: {},
  mobileSelect: {},
  mobileIconBtn: {},
  mobileVolumeRow: { display: 'none' },
  mobileVolumeSlider: {},
};

export default PlayerPage;
