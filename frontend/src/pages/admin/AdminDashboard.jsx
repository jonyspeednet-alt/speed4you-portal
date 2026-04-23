import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminService } from '../../services';
import { useBreakpoint } from '../../hooks';

const AdminDashboard = () => {
  const { isMobile, isTablet } = useBreakpoint();
  const [dashboard, setDashboard] = useState({
    stats: {},
    recentContent: [],
    scannerDrafts: [],
  });
  const [error, setError] = useState('');
  const [normalizer, setNormalizer] = useState({ running: false, state: null, recentLogLines: [] });
  const [normalizerBusy, setNormalizerBusy] = useState(false);
  const [normalizerError, setNormalizerError] = useState('');

  useEffect(() => {
    adminService.getDashboard()
      .then((response) => {
        setDashboard(response);
        setError('');
      })
      .catch((loadError) => {
        setError(loadError.message || 'Failed to load admin dashboard.');
      });
  }, []);

  useEffect(() => {
    let active = true;

    const loadStatus = () => {
      adminService.getMediaNormalizerStatus()
        .then((response) => {
          if (!active) {
            return;
          }
          setNormalizer(response || { running: false, state: null, recentLogLines: [] });
          setNormalizerError('');
        })
        .catch((loadError) => {
          if (!active) {
            return;
          }
          setNormalizerError(loadError.message || 'Failed to load media normalizer status.');
        });
    };

    loadStatus();
    const timer = setInterval(loadStatus, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const handleNormalizerAction = async (action) => {
    try {
      setNormalizerBusy(true);
      setNormalizerError('');
      if (action === 'start') {
        const response = await adminService.startMediaNormalizer();
        setNormalizer(response.status || response);
      } else {
        const response = await adminService.stopMediaNormalizer();
        setNormalizer(response.status || response);
      }
    } catch (actionError) {
      setNormalizerError(actionError.message || 'Failed to update normalizer status.');
    } finally {
      setNormalizerBusy(false);
    }
  };

  const stats = [
    { label: 'Total Movies', value: dashboard.stats.totalMovies || 0, change: 'catalog items' },
    { label: 'Total Series', value: dashboard.stats.totalSeries || 0, change: 'season-aware entries' },
    { label: 'Draft Content', value: dashboard.stats.draftContent || 0, change: 'review pending' },
    { label: 'Published', value: dashboard.stats.publishedContent || 0, change: 'live on portal' },
  ];
  const currentProgress = normalizer.state?.currentFileProgress || null;
  const percentValue = Math.max(0, Math.min(100, Number(currentProgress?.percent || 0)));
  const formatSeconds = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    if (hh > 0) {
      return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  return (
    <div style={styles.page}>
      <section style={{ ...styles.heroCard, ...(isMobile ? styles.heroCardMobile : isTablet ? styles.heroCardTablet : {}) }}>
        <div>
          <span style={styles.kicker}>Admin Pulse</span>
          <h2 style={styles.heroTitle}>Monitor scanner imports, review metadata quality, and publish with less guesswork.</h2>
        </div>
        <div style={styles.heroActions}>
          <Link to="/admin/content/new" style={styles.primaryAction}>Add New Content</Link>
          <Link to="/admin/content" style={styles.secondaryAction}>Open Content Library</Link>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} style={styles.statCard}>
            <span style={styles.statLabel}>{stat.label}</span>
            <span style={styles.statValue}>{stat.value}</span>
            <span style={styles.statChange}>{stat.change}</span>
          </div>
        ))}
      </div>

      <div style={{ ...styles.grid, ...(isMobile || isTablet ? styles.gridMobile : {}) }}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <span style={styles.sectionEyebrow}>Editorial Queue</span>
              <h2 style={styles.sectionTitle}>Recent Content</h2>
            </div>
            <Link to="/admin/content" style={styles.viewAll}>View All</Link>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.recentContent || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong style={styles.itemTitle}>{item.title}</strong>
                      <span style={styles.itemMeta}>{item.category || 'Uncategorized'}</span>
                    </td>
                    <td>{item.type}</td>
                    <td>
                      <span
                        style={{
                          ...styles.status,
                          ...(item.status === 'published' ? styles.statusPublished : styles.statusDraft),
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>{item.sourceType === 'scanner' ? 'Scanner' : 'Manual'}</td>
                    <td>
                      <Link to={`/admin/content/${item.id}/edit`} style={styles.editBtn}>Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.sidePanel}>
          <h2 style={styles.sectionTitle}>Quick Actions</h2>
          <div style={styles.actions}>
            <Link to="/admin/content/new" style={styles.actionBtn}>Create Manual Entry</Link>
            <Link to="/admin/content" style={styles.actionBtn}>Review Scanner Drafts</Link>
            <Link to="/admin/movies" style={styles.actionBtn}>Open Movies Queue</Link>
            <Link to="/admin/series" style={styles.actionBtn}>Open Series Queue</Link>
          </div>

          <div style={styles.noteCard}>
            <span style={styles.sectionEyebrow}>Scanner Drafts</span>
            <p style={styles.noteText}>
              {(dashboard.scannerDrafts || []).length
                ? `${dashboard.scannerDrafts.length} scanner drafts are waiting for review.`
                : 'No scanner drafts are currently waiting for review.'}
            </p>
          </div>

          <div style={styles.normalizerCard}>
            <div style={styles.normalizerHeader}>
              <span style={styles.sectionEyebrow}>Media Normalizer</span>
              <span style={{ ...styles.status, ...(normalizer.running ? styles.statusPublished : styles.statusDraft) }}>
                {normalizer.running ? 'Running' : 'Stopped'}
              </span>
            </div>
            <p style={styles.noteText}>
              One-by-one convert: MP4 container, H.264 video, AAC audio, faststart.
            </p>
            <div style={styles.normalizerStats}>
              <span>Converted: {normalizer.state?.stats?.converted || 0}</span>
              <span>Already OK: {normalizer.state?.stats?.skippedAlreadyOk || 0}</span>
              <span>Failed: {normalizer.state?.stats?.failed || 0}</span>
            </div>
            {currentProgress ? (
              <div style={styles.progressCard}>
                <div style={styles.progressTopRow}>
                  <strong style={styles.progressTitle}>Current File</strong>
                  <span style={styles.progressPercent}>{percentValue.toFixed(1)}%</span>
                </div>
                <div style={styles.progressPath} title={currentProgress.filePath}>{currentProgress.filePath}</div>
                <div style={styles.progressBarTrack}>
                  <div style={{ ...styles.progressBarFill, width: `${percentValue}%` }} />
                </div>
                <div style={styles.progressMeta}>
                  <span>{formatSeconds(currentProgress.progressSeconds)} / {formatSeconds(currentProgress.durationSeconds)}</span>
                  <span>Speed: {currentProgress.speed || '-'}</span>
                  <span>Phase: {currentProgress.phase || '-'}</span>
                </div>
              </div>
            ) : null}
            <div style={styles.heroActions}>
              <button
                type="button"
                style={styles.primaryAction}
                onClick={() => handleNormalizerAction('start')}
                disabled={normalizerBusy || normalizer.running}
              >
                Start Worker
              </button>
              <button
                type="button"
                style={styles.secondaryAction}
                onClick={() => handleNormalizerAction('stop')}
                disabled={normalizerBusy || !normalizer.running}
              >
                Stop Worker
              </button>
            </div>
            {normalizerError ? <div style={styles.errorInline}>{normalizerError}</div> : null}
            <div style={styles.logBox}>
              {(normalizer.recentLogLines || []).length
                ? normalizer.recentLogLines.slice(-8).map((line, index) => (
                  <div key={`${index}-${line}`}>{line}</div>
                ))
                : <div>No runtime logs yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const styles = {
  page: { display: 'grid', gap: '22px' },
  heroCard: {
    padding: '28px',
    borderRadius: '32px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: '18px',
    alignItems: 'end',
  },
  heroCardTablet: {
    gridTemplateColumns: '1fr',
  },
  heroCardMobile: {
    padding: '20px',
    gridTemplateColumns: '1fr',
  },
  kicker: { display: 'inline-block', marginBottom: '10px', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: '0.72rem', fontWeight: '700' },
  heroTitle: { color: 'var(--text-primary)', maxWidth: '18ch' },
  heroActions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  primaryAction: { padding: '14px 20px', borderRadius: '999px', background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)', color: '#fff', fontWeight: '700', boxShadow: '0 12px 30px rgba(255,90,95,0.24)' },
  secondaryAction: { padding: '14px 20px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: '700' },
  errorBox: { padding: '14px 18px', borderRadius: '18px', background: 'rgba(255, 90, 95, 0.12)', color: '#ff8a8a', border: '1px solid rgba(255, 90, 95, 0.24)' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' },
  statCard: { padding: '24px', borderRadius: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '8px' },
  statLabel: { color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: '700' },
  statValue: { fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' },
  statChange: { color: '#4ade80', fontSize: '0.86rem', fontWeight: '700' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 340px', gap: '22px' },
  gridMobile: { gridTemplateColumns: '1fr' },
  section: { padding: '24px', borderRadius: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' },
  sidePanel: { padding: '24px', borderRadius: '28px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '18px', alignContent: 'start' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '16px', marginBottom: '16px' },
  sectionEyebrow: { display: 'inline-block', marginBottom: '6px', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', fontWeight: '700' },
  sectionTitle: { fontSize: '1.5rem', color: 'var(--text-primary)' },
  viewAll: { color: 'var(--accent-red)', fontSize: '0.9rem', fontWeight: '700' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 10px' },
  itemTitle: { display: 'block', color: 'var(--text-primary)' },
  itemMeta: { display: 'block', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' },
  status: { padding: '6px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'capitalize', display: 'inline-flex' },
  statusPublished: { background: 'rgba(34, 197, 94, 0.12)', color: '#4ade80' },
  statusDraft: { background: 'rgba(234, 179, 8, 0.12)', color: '#facc15' },
  editBtn: { padding: '8px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: '700', display: 'inline-flex' },
  actions: { display: 'grid', gap: '12px' },
  actionBtn: { padding: '14px 18px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', borderRadius: '22px', fontWeight: '700', border: '1px solid rgba(255,255,255,0.08)' },
  noteCard: { padding: '20px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(255,200,87,0.08), rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.08)' },
  noteText: { lineHeight: '1.8' },
  normalizerCard: { padding: '20px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '12px' },
  normalizerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  normalizerStats: { display: 'grid', gap: '6px', color: 'var(--text-muted)', fontSize: '0.84rem' },
  logBox: { marginTop: '6px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '180px', overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--text-secondary)', lineHeight: '1.45' },
  errorInline: { padding: '8px 10px', borderRadius: '10px', background: 'rgba(255, 90, 95, 0.12)', color: '#ff8a8a', border: '1px solid rgba(255, 90, 95, 0.22)', fontSize: '0.82rem' },
  progressCard: { padding: '10px 12px', borderRadius: '12px', background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '8px' },
  progressTopRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  progressTitle: { color: 'var(--text-primary)', fontSize: '0.86rem' },
  progressPercent: { color: '#4ade80', fontSize: '0.84rem', fontWeight: '700' },
  progressPath: { color: 'var(--text-secondary)', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  progressBarTrack: { height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #22c55e, #84cc16)' },
  progressMeta: { display: 'flex', justifyContent: 'space-between', gap: '10px', color: 'var(--text-muted)', fontSize: '0.72rem', flexWrap: 'wrap' },
};

export default AdminDashboard;
