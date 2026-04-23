import { useEffect, useMemo, useState } from 'react';
import tvService from '../services/tvService';
import { useBreakpoint } from '../hooks';

const TV_API_BASE = (import.meta.env.VITE_API_URL || '/portal-api').replace(/\/$/, '');

function withApiBase(path) {
  if (!path) {
    return '';
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${TV_API_BASE}${path}`;
}

function TVPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const [payload, setPayload] = useState({ categories: [], channels: [], defaultStreamId: '' });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playerDiagnostics, setPlayerDiagnostics] = useState({
    streamId: '',
    state: 'Waiting for player diagnostics...',
    source: '',
    lines: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadChannels() {
      try {
        setLoading(true);
        setError('');
        const response = await tvService.getChannels();

        if (!cancelled) {
          setPayload(response);
          setSelectedStreamId(response.defaultStreamId || response.channels?.[0]?.streamId || '');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'TV channels are unavailable right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => ['All', ...(payload.categories || [])], [payload.categories]);

  const filteredChannels = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return (payload.channels || []).filter((channel) => {
      const categoryMatch = selectedCategory === 'All'
        || channel.category === selectedCategory
        || channel.categories?.includes(selectedCategory);
      if (!categoryMatch) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${channel.name} ${channel.category}`.toLowerCase().includes(query);
    });
  }, [payload.channels, searchText, selectedCategory]);

  const selectedChannel = useMemo(() => (
    (payload.channels || []).find((channel) => channel.streamId === selectedStreamId)
    || filteredChannels[0]
    || null
  ), [filteredChannels, payload.channels, selectedStreamId]);

  const playerUrl = selectedChannel
    ? withApiBase(`/api/tv/player/${selectedChannel.streamId}?${new URLSearchParams({
      name: selectedChannel.name || '',
      category: selectedChannel.category || '',
    }).toString()}`)
    : '';

  useEffect(() => {
    if (!selectedChannel && filteredChannels[0]) {
      setSelectedStreamId(filteredChannels[0].streamId);
    }
  }, [filteredChannels, selectedChannel]);

  useEffect(() => {
    function handleMessage(event) {
      const data = event.data;
      if (!data || data.type !== 'tv-player-debug') {
        return;
      }

      setPlayerDiagnostics({
        streamId: data.streamId || '',
        state: data.state || '',
        source: data.source || '',
        lines: Array.isArray(data.lines) ? data.lines : [],
      });
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    setPlayerDiagnostics({
      streamId: selectedChannel?.streamId || '',
      state: selectedChannel ? 'Loading player diagnostics...' : 'Waiting for player diagnostics...',
      source: playerUrl,
      lines: [],
    });
  }, [playerUrl, selectedChannel]);

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <section style={{ ...styles.hero, ...(isMobile ? styles.heroMobile : isTablet ? styles.heroTablet : {}) }}>
        <div style={styles.heroCopy}>
          <span style={styles.eyebrow}>Live TV</span>
          <h1 style={styles.title}>Channel surfing, now inside the portal.</h1>
          <p style={styles.description}>
            Bangla, Sports, English, Kids, Hindi, and more are now grouped into a dedicated TV section so users can jump into live channels without leaving the site.
          </p>
          <div style={{ ...styles.metaRow, ...(isMobile ? styles.metaRowMobile : {}) }}>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Channels</span>
              <strong style={styles.metaValue}>{payload.channels?.length || 0}</strong>
            </div>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Categories</span>
              <strong style={styles.metaValue}>{payload.categories?.length || 0}</strong>
            </div>
            <div style={styles.metaCard}>
              <span style={styles.metaLabel}>Selected</span>
              <strong style={styles.metaValue}>{selectedChannel?.name || 'Waiting'}</strong>
            </div>
          </div>
        </div>

        <div style={{ ...styles.heroPanel, ...(isMobile ? styles.heroPanelMobile : {}) }}>
          <label style={styles.searchWrap}>
            <span style={styles.searchLabel}>Find channel</span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name or category"
              style={styles.searchInput}
            />
          </label>

          <div style={{ ...styles.categoryWrap, ...(isMobile ? styles.categoryWrapMobile : {}) }}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                style={{
                  ...styles.categoryChip,
                  ...(selectedCategory === category ? styles.categoryChipActive : {}),
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...styles.layout, ...(isMobile ? styles.layoutMobile : isTablet ? styles.layoutTablet : {}) }}>
        <div style={styles.playerColumn}>
          <div style={{ ...styles.playerFrameWrap, ...(isMobile ? styles.playerFrameWrapMobile : {}) }}>
            {loading ? (
              <div style={styles.playerState}>Loading live TV channels...</div>
            ) : error ? (
              <div style={styles.playerState}>{error}</div>
            ) : playerUrl ? (
              <iframe
                key={selectedChannel?.streamId}
                src={playerUrl}
                title={selectedChannel?.name || 'TV Player'}
                style={{ ...styles.playerFrame, ...(isMobile ? styles.playerFrameMobile : {}) }}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <div style={styles.playerState}>No live TV channel is selected.</div>
            )}
          </div>

          <div style={styles.nowPlaying}>
            <span style={styles.nowPlayingLabel}>Now Playing</span>
            <strong style={styles.nowPlayingTitle}>{selectedChannel?.name || 'Select a channel'}</strong>
            <span style={styles.nowPlayingMeta}>{selectedChannel?.category || 'Live TV'}</span>
          </div>

          <div style={styles.diagnosticsCard}>
            <div style={styles.diagnosticsHeader}>
              <span style={styles.diagnosticsEyebrow}>Player Diagnostics</span>
              <strong style={styles.diagnosticsState}>{playerDiagnostics.state}</strong>
            </div>
            <div style={styles.diagnosticsMeta}>
              <span>Stream: {playerDiagnostics.streamId || selectedChannel?.streamId || 'n/a'}</span>
              <span>Source: {playerDiagnostics.source || 'Waiting...'}</span>
            </div>
            <pre style={styles.diagnosticsLog}>
              {playerDiagnostics.lines.length > 0
                ? playerDiagnostics.lines.join('\n')
                : 'Player debug events will appear here after the iframe starts reporting.'}
            </pre>
          </div>
        </div>

        <div style={{ ...styles.listColumn, ...(isMobile ? styles.listColumnMobile : {}) }}>
          <div style={styles.listHeader}>
            <div>
              <span style={styles.listEyebrow}>TV Section</span>
              <h2 style={styles.listTitle}>Choose a live channel</h2>
            </div>
            <span style={styles.countBadge}>{filteredChannels.length} visible</span>
          </div>

          <div style={{ ...styles.channelGrid, ...(isMobile ? styles.channelGridMobile : {}) }}>
            {filteredChannels.map((channel) => {
              const isActive = channel.streamId === selectedChannel?.streamId;

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedStreamId(channel.streamId)}
                  style={{
                    ...styles.channelCard,
                    ...(isMobile ? styles.channelCardMobile : {}),
                    ...(isActive ? styles.channelCardActive : {}),
                  }}
                >
                  <div style={styles.logoBox}>
                    <img src={withApiBase(channel.logoPath)} alt={channel.name} style={styles.channelLogo} loading="lazy" />
                  </div>
                  <div style={styles.channelInfo}>
                    <strong style={styles.channelName}>{channel.name}</strong>
                    <span style={styles.channelCategory}>{channel.category}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '0 var(--spacing-lg) var(--spacing-3xl)',
  },
  pageMobile: {
    padding: '0 var(--spacing-md) var(--spacing-2xl)',
  },
  hero: {
    maxWidth: '1440px',
    margin: '0 auto 24px auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
    gap: 'var(--spacing-xl)',
    alignItems: 'stretch',
  },
  heroTablet: {
    gridTemplateColumns: '1fr',
  },
  heroMobile: {
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  heroCopy: {
    padding: '32px',
    borderRadius: '30px',
    background: 'linear-gradient(160deg, rgba(8,20,36,0.94), rgba(18,39,64,0.78) 54%, rgba(145,49,38,0.56))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-hero)',
  },
  eyebrow: {
    display: 'inline-block',
    marginBottom: '14px',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: 'var(--accent-amber)',
    fontWeight: '700',
  },
  title: {
    maxWidth: '11ch',
    color: 'var(--text-primary)',
    marginBottom: '14px',
    fontSize: 'clamp(2.6rem, 5vw, 4.8rem)',
  },
  description: {
    maxWidth: '58ch',
    color: 'var(--text-secondary)',
    lineHeight: '1.8',
    marginBottom: '24px',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
  },
  metaRowMobile: {
    gridTemplateColumns: '1fr',
  },
  metaCard: {
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  metaLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  metaValue: {
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontWeight: '800',
    lineHeight: '1.4',
  },
  heroPanel: {
    padding: '28px',
    borderRadius: '30px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '18px',
    alignContent: 'start',
    boxShadow: 'var(--shadow-soft)',
  },
  heroPanelMobile: {
    padding: '16px',
    borderRadius: '22px',
  },
  searchWrap: {
    display: 'grid',
    gap: '10px',
  },
  searchLabel: {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  searchInput: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(6,14,24,0.78)',
    color: 'var(--text-primary)',
  },
  categoryWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  categoryWrapMobile: {
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingBottom: '4px',
    scrollbarWidth: 'none',
  },
  categoryChip: {
    padding: '10px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    fontWeight: '700',
  },
  categoryChipActive: {
    color: '#08111d',
    background: 'var(--accent-amber)',
    borderColor: 'transparent',
  },
  layout: {
    maxWidth: '1440px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)',
    gap: 'var(--spacing-xl)',
    alignItems: 'start',
  },
  layoutTablet: {
    gridTemplateColumns: '1fr',
  },
  layoutMobile: {
    gridTemplateColumns: '1fr',
  },
  playerColumn: {
    display: 'grid',
    gap: '16px',
  },
  playerFrameWrap: {
    minHeight: '540px',
    borderRadius: '30px',
    overflow: 'hidden',
    background: '#02060c',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-hero)',
  },
  playerFrameWrapMobile: {
    minHeight: '240px',
  },
  playerFrame: {
    width: '100%',
    minHeight: '540px',
    border: '0',
    background: '#000',
  },
  playerFrameMobile: {
    minHeight: '240px',
  },
  playerState: {
    minHeight: '540px',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-secondary)',
    padding: '24px',
    textAlign: 'center',
  },
  nowPlaying: {
    padding: '20px 24px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '8px',
  },
  nowPlayingLabel: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--accent-cyan)',
    fontWeight: '700',
  },
  nowPlayingTitle: {
    color: 'var(--text-primary)',
    fontSize: '1.25rem',
  },
  nowPlayingMeta: {
    color: 'var(--text-secondary)',
  },
  diagnosticsCard: {
    padding: '20px 24px',
    borderRadius: '24px',
    background: 'rgba(8,16,28,0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gap: '10px',
  },
  diagnosticsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  diagnosticsEyebrow: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  diagnosticsState: {
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
  },
  diagnosticsMeta: {
    display: 'grid',
    gap: '4px',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    wordBreak: 'break-all',
  },
  diagnosticsLog: {
    margin: 0,
    padding: '14px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#d9e6ff',
    fontSize: '0.8rem',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '220px',
    overflow: 'auto',
  },
  listColumn: {
    padding: '22px',
    borderRadius: '30px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-soft)',
  },
  listColumnMobile: {
    padding: '16px',
    borderRadius: '22px',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '16px',
  },
  listEyebrow: {
    display: 'inline-block',
    marginBottom: '8px',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    fontWeight: '700',
  },
  listTitle: {
    color: 'var(--text-primary)',
    fontSize: '1.6rem',
  },
  countBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    fontWeight: '700',
  },
  channelGrid: {
    display: 'grid',
    gap: '12px',
    maxHeight: '760px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  channelGridMobile: {
    maxHeight: 'none',
  },
  channelCard: {
    display: 'grid',
    gridTemplateColumns: '88px minmax(0, 1fr)',
    gap: '14px',
    alignItems: 'center',
    padding: '14px',
    borderRadius: '22px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    textAlign: 'left',
  },
  channelCardMobile: {
    gridTemplateColumns: '72px minmax(0, 1fr)',
    gap: '12px',
    padding: '12px',
    borderRadius: '18px',
  },
  channelCardActive: {
    background: 'rgba(255, 200, 87, 0.1)',
    borderColor: 'rgba(255, 200, 87, 0.42)',
    boxShadow: '0 12px 28px rgba(255, 200, 87, 0.12)',
  },
  logoBox: {
    height: '58px',
    borderRadius: '16px',
    background: '#fff',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    padding: '8px',
  },
  channelLogo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  channelInfo: {
    display: 'grid',
    gap: '6px',
  },
  channelName: {
    color: 'var(--text-primary)',
    fontSize: '0.96rem',
    lineHeight: '1.4',
  },
  channelCategory: {
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: '700',
  },
};

export default TVPage;
