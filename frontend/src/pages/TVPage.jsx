import { useEffect, useMemo, useRef, useState } from 'react';
import tvService from '../services/tvService';
import { useBreakpoint } from '../hooks';

const TV_API_BASE = (import.meta.env.VITE_API_URL || '/portal-api').replace(/\/$/, '');

function withApiBase(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${TV_API_BASE}${path}`;
}

const CATEGORY_COLORS = {
  'Bangla': '#ffc857',
  'Bengali': '#ffc857',
  'Sports': '#4ade80',
  'News': '#60a5fa',
  'Kids': '#f472b6',
  'Hindi': '#fb923c',
  'English': '#7df9ff',
  'Movies': '#c084fc',
  'Music': '#f9a8d4',
};

function getCategoryColor(category) {
  if (!category) return 'rgba(255,255,255,0.18)';
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return 'rgba(255,255,255,0.18)';
}

function LiveDot() {
  return (
    <span style={s.liveDot} aria-label="Live" />
  );
}

function ChannelLogo({ src, name, size = 44 }) {
  const [err, setErr] = useState(false);
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ ...s.logoBox, width: size, height: size }}>
      {!err && src ? (
        <img src={src} alt={name} style={s.logoImg} loading="lazy" onError={() => setErr(true)} />
      ) : (
        <span style={{ ...s.logoInitials, fontSize: size * 0.3 }}>{initials}</span>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={s.skeletonCard}>
      <div style={s.skeletonLogo} />
      <div style={s.skeletonLines}>
        <div style={{ ...s.skeletonLine, width: '70%' }} />
        <div style={{ ...s.skeletonLine, width: '45%', height: 10 }} />
      </div>
    </div>
  );
}

export default function TVPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [payload, setPayload] = useState({ categories: [], channels: [], defaultStreamId: '' });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerLoading, setPlayerLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const channelListRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await tvService.getChannels();
        if (!cancelled) {
          setPayload(res);
          setSelectedStreamId(res.defaultStreamId || res.channels?.[0]?.streamId || '');
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'TV channels unavailable right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => ['All', ...(payload.categories || [])], [payload.categories]);

  const filteredChannels = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return (payload.channels || []).filter((ch) => {
      const catMatch = selectedCategory === 'All'
        || ch.category === selectedCategory
        || ch.categories?.includes(selectedCategory);
      if (!catMatch) return false;
      if (!q) return true;
      return `${ch.name} ${ch.category}`.toLowerCase().includes(q);
    });
  }, [payload.channels, searchText, selectedCategory]);

  const selectedChannel = useMemo(() => (
    (payload.channels || []).find((ch) => ch.streamId === selectedStreamId)
    || filteredChannels[0]
    || null
  ), [filteredChannels, payload.channels, selectedStreamId]);

  useEffect(() => {
    if (!selectedChannel && filteredChannels[0]) {
      setSelectedStreamId(filteredChannels[0].streamId);
    }
  }, [filteredChannels, selectedChannel]);

  // Reset player loading state when channel changes
  useEffect(() => {
    setPlayerLoading(true);
  }, [selectedStreamId]);

  const playerUrl = selectedChannel
    ? withApiBase(`/api/tv/player/${selectedChannel.streamId}?${new URLSearchParams({
      name: selectedChannel.name || '',
      category: selectedChannel.category || '',
    })}`)
    : '';

  const catColor = getCategoryColor(selectedChannel?.category);
  const isNarrow = isMobile || isTablet;

  function selectChannel(streamId) {
    setSelectedStreamId(streamId);
    if (isMobile) setSidebarOpen(false);
  }

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={s.page}>

      {/* â”€â”€ Top bar â”€â”€ */}
      <div style={s.topBar}>
        <div style={s.topBarLeft}>
          <span style={s.liveBadge}>
            <LiveDot />
            LIVE TV
          </span>
          {selectedChannel && (
            <div style={s.nowPlayingBar}>
              <ChannelLogo src={withApiBase(selectedChannel.logoPath)} name={selectedChannel.name} size={28} />
              <div style={s.nowPlayingInfo}>
                <span style={s.nowPlayingName}>{selectedChannel.name}</span>
                <span style={{ ...s.nowPlayingCat, color: catColor }}>{selectedChannel.category}</span>
              </div>
            </div>
          )}
        </div>
        <div style={s.topBarRight}>
          <span style={s.channelCount}>{payload.channels?.length || 0} channels</span>
          {isMobile && (
            <button
              style={s.sidebarToggle}
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle channel list"
              aria-expanded={sidebarOpen}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                {sidebarOpen
                  ? <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  : <path d="M4 6h16v2H4zm4 5h12v2H8zm4 5h8v2h-8z" />
                }
              </svg>
              <span>{sidebarOpen ? 'Close' : 'Channels'}</span>
            </button>
          )}
        </div>
      </div>

      {/* â”€â”€ Main layout â”€â”€ */}
      <div style={{ ...s.layout, ...(isNarrow ? s.layoutNarrow : {}) }}>

        {/* â”€â”€ Player column â”€â”€ */}
        <div style={s.playerCol}>

          {/* Player frame */}
          <div style={s.playerWrap}>
            {loading ? (
              <div style={s.playerPlaceholder}>
                <div style={s.spinnerWrap}>
                  <div style={s.spinner} />
                </div>
                <p style={s.placeholderText}>Loading channels…</p>
              </div>
            ) : error ? (
              <div style={s.playerPlaceholder}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={s.placeholderText}>{error}</p>
              </div>
            ) : playerUrl ? (
              <>
                {playerLoading && (
                  <div style={s.playerOverlay}>
                    <div style={s.spinner} />
                  </div>
                )}
                <iframe
                  key={selectedChannel?.streamId}
                  src={playerUrl}
                  title={selectedChannel?.name || 'TV Player'}
                  style={s.playerFrame}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  onLoad={() => setPlayerLoading(false)}
                />
              </>
            ) : (
              <div style={s.playerPlaceholder}>
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="15" rx="2" /><polyline points="17 2 12 7 7 2" />
                </svg>
                <p style={s.placeholderText}>No channel selected</p>
              </div>
            )}
          </div>

          {/* Channel info strip */}
          {selectedChannel && (
            <div style={{ ...s.infoStrip, borderColor: `${catColor}44` }}>
              <ChannelLogo src={withApiBase(selectedChannel.logoPath)} name={selectedChannel.name} size={48} />
              <div style={s.infoStripText}>
                <div style={s.infoStripName}>{selectedChannel.name}</div>
                <div style={{ ...s.infoStripCat, color: catColor }}>{selectedChannel.category || 'Live TV'}</div>
              </div>
              <div style={s.infoStripRight}>
                <span style={s.liveTag}>
                  <LiveDot />
                  LIVE
                </span>
              </div>
            </div>
          )}

          {/* Mobile: category pills + search inline */}
          {isMobile && (
            <div style={s.mobileCatBar}>
              <div style={s.mobileCatScroll}>
                {categories.map((cat) => {
                  const cc = getCategoryColor(cat);
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      style={{
                        ...s.catChip,
                        ...(active ? { background: cc, color: '#08111d', borderColor: 'transparent' } : {}),
                      }}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* â”€â”€ Sidebar / Channel list â”€â”€ */}
        <div
          style={{
            ...s.sidebar,
            ...(isNarrow ? s.sidebarNarrow : {}),
            ...(isMobile && !sidebarOpen ? s.sidebarHidden : {}),
          }}
          ref={channelListRef}
        >
          {/* Sidebar header */}
          <div style={s.sidebarHeader}>
            <div style={s.sidebarSearch}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search channels…"
                style={s.searchInput}
                aria-label="Search channels"
              />
              {searchText && (
                <button style={s.clearBtn} onClick={() => setSearchText('')} aria-label="Clear search">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Category pills â€” desktop/tablet only */}
            {!isMobile && (
              <div style={s.catPills}>
                {categories.map((cat) => {
                  const cc = getCategoryColor(cat);
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      style={{
                        ...s.catChip,
                        ...(active ? { background: cc, color: '#08111d', borderColor: 'transparent' } : {}),
                      }}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={s.sidebarMeta}>
              <span style={s.sidebarMetaText}>{filteredChannels.length} channels</span>
              {searchText && (
                <span style={s.sidebarMetaText}>Â· "{searchText}"</span>
              )}
            </div>
          </div>

          {/* Channel list */}
          <div style={s.channelList}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            ) : filteredChannels.length === 0 ? (
              <div style={s.emptyState}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p style={s.emptyText}>No channels found</p>
                <button style={s.emptyReset} onClick={() => { setSearchText(''); setSelectedCategory('All'); }}>
                  Clear filters
                </button>
              </div>
            ) : (
              filteredChannels.map((ch) => {
                const active = ch.streamId === selectedChannel?.streamId;
                const cc = getCategoryColor(ch.category);
                return (
                  <button
                    key={ch.id || ch.streamId}
                    style={{
                      ...s.channelCard,
                      ...(active ? { ...s.channelCardActive, boxShadow: `0 0 0 1.5px ${cc}55, 0 8px 24px rgba(0,0,0,0.28)` } : {}),
                    }}
                    onClick={() => selectChannel(ch.streamId)}
                    aria-pressed={active}
                  >
                    <div style={{ ...s.channelAccent, background: cc }} />
                    <ChannelLogo src={withApiBase(ch.logoPath)} name={ch.name} size={42} />
                    <div style={s.channelInfo}>
                      <span style={s.channelName}>{ch.name}</span>
                      <span style={{ ...s.channelCat, color: cc }}>{ch.category}</span>
                    </div>
                    {active && <LiveDot />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const s = {
  // Page
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    padding: '96px var(--spacing-lg) var(--spacing-2xl)',
  },

  // Top bar
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 0 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'rgba(239,68,68,0.14)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444',
    fontSize: '0.72rem',
    fontWeight: '800',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  liveDot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239,68,68,0.28)',
    animation: 'glowPulse 1.8s ease-in-out infinite',
    flexShrink: 0,
  },
  nowPlayingBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px 6px 6px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  nowPlayingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  nowPlayingName: {
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    fontWeight: '700',
    lineHeight: 1.2,
  },
  nowPlayingCat: {
    fontSize: '0.68rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.2,
  },
  channelCount: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  sidebarToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    padding: '9px 14px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '0.82rem',
    minHeight: '40px',
  },

  // Layout
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) 360px',
    gap: '20px',
    alignItems: 'start',
    flex: 1,
  },
  layoutNarrow: {
    gridTemplateColumns: '1fr',
  },

  // Player column
  playerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  playerWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 9',
    borderRadius: '20px',
    overflow: 'hidden',
    background: '#02060c',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  playerFrame: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#000',
  },
  playerOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(2,6,12,0.82)',
    zIndex: 2,
  },
  playerPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    color: 'var(--text-muted)',
  },
  placeholderText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    textAlign: 'center',
    padding: '0 24px',
  },
  spinnerWrap: {
    display: 'grid',
    placeItems: 'center',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--accent-amber)',
    animation: 'spin 0.8s linear infinite',
  },

  // Info strip below player
  infoStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 18px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid',
    borderColor: 'rgba(255,255,255,0.08)',
    transition: 'border-color 300ms ease',
  },
  infoStripText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    overflow: 'hidden',
  },
  infoStripName: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontWeight: '700',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  infoStripCat: {
    fontSize: '0.74rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  infoStripRight: {
    flexShrink: 0,
  },
  liveTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 10px',
    borderRadius: '999px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444',
    fontSize: '0.68rem',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  // Mobile category bar
  mobileCatBar: {
    overflow: 'hidden',
  },
  mobileCatScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },

  // Category chips
  catPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  catChip: {
    padding: '7px 13px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    transition: 'all 150ms ease',
    minHeight: '34px',
  },

  // Sidebar
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'sticky',
    top: '90px',
    maxHeight: 'calc(100vh - 110px)',
  },
  sidebarNarrow: {
    position: 'static',
    maxHeight: 'none',
  },
  sidebarHidden: {
    display: 'none',
  },
  sidebarHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  sidebarSearch: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'rgba(6,14,24,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    minWidth: 0,
  },
  clearBtn: {
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-muted)',
    padding: '2px',
    borderRadius: '4px',
    minHeight: 'unset',
    minWidth: 'unset',
  },
  sidebarMeta: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  sidebarMetaText: {
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: '600',
  },

  // Channel list
  channelList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  // Channel card
  channelCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    textAlign: 'left',
    transition: 'all 150ms ease',
    position: 'relative',
    overflow: 'hidden',
    minHeight: '64px',
  },
  channelCardActive: {
    background: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  channelAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '3px',
    borderRadius: '3px 0 0 3px',
    opacity: 0.7,
  },
  channelInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    overflow: 'hidden',
    minWidth: 0,
  },
  channelName: {
    color: 'var(--text-primary)',
    fontSize: '0.88rem',
    fontWeight: '700',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  channelCat: {
    fontSize: '0.7rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.2,
  },

  // Logo
  logoBox: {
    borderRadius: '10px',
    background: '#fff',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    padding: '5px',
    flexShrink: 0,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  logoInitials: {
    fontWeight: '800',
    color: '#07111f',
    letterSpacing: '0.04em',
    lineHeight: 1,
  },

  // Skeleton
  skeletonCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  skeletonLogo: {
    width: 42,
    height: 42,
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.07)',
    flexShrink: 0,
    animation: 'shimmer 1.4s linear infinite',
    backgroundSize: '200% 100%',
    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
  },
  skeletonLines: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  skeletonLine: {
    height: 13,
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.07)',
    animation: 'shimmer 1.4s linear infinite',
    backgroundSize: '200% 100%',
    backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
  },

  // Empty state
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
  },
  emptyReset: {
    padding: '8px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
    fontSize: '0.82rem',
    minHeight: 'unset',
  },
};
