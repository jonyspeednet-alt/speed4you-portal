function Skeleton({ width, height, borderRadius = 'var(--radius-md)', style = {} }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function PosterSkeleton() {
  return (
    <div style={styles.posterWrapper}>
      <Skeleton height="100%" borderRadius="0" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={styles.card} aria-hidden="true">
      <div style={styles.posterWrapper}>
        <Skeleton height="100%" borderRadius="var(--radius-lg)" />
      </div>
      <div style={styles.titleRow}>
        <Skeleton width="72%" height="14px" borderRadius="6px" />
      </div>
      <div style={styles.metaRow}>
        <Skeleton width="44%" height="11px" borderRadius="6px" />
      </div>
    </div>
  );
}

export function RailSkeleton({ count = 5 }) {
  return (
    <div style={styles.rail} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={styles.railItem}>
          <CardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function HeroBannerSkeleton() {
  return (
    <div style={styles.heroBanner} aria-hidden="true">
      <Skeleton height="100%" borderRadius="0" />
      <div style={styles.heroBannerContent}>
        <Skeleton width="55%" height="48px" borderRadius="10px" style={{ marginBottom: '16px' }} />
        <Skeleton width="80%" height="16px" borderRadius="6px" style={{ marginBottom: '8px' }} />
        <Skeleton width="65%" height="16px" borderRadius="6px" style={{ marginBottom: '28px' }} />
        <div style={styles.heroBannerButtons}>
          <Skeleton width="130px" height="48px" borderRadius="999px" />
          <Skeleton width="130px" height="48px" borderRadius="999px" />
        </div>
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div style={styles.hero}>
      <Skeleton height="100%" borderRadius="0" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div style={styles.detail}>
      <div style={styles.detailHero}>
        <Skeleton height="400px" borderRadius="var(--radius-lg)" style={{ minWidth: '260px', maxWidth: '280px' }} />
        <div style={styles.detailInfo}>
          <Skeleton width="60%" height="40px" borderRadius="10px" />
          <div style={styles.detailMeta}>
            <Skeleton width="100%" height="20px" borderRadius="6px" />
          </div>
          <Skeleton width="80%" height="16px" borderRadius="6px" />
          <Skeleton width="90%" height="60px" borderRadius="10px" />
        </div>
      </div>
    </div>
  );
}

const styles = {
  posterWrapper: {
    aspectRatio: '3 / 4',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.03)',
  },
  card: {
    width: '100%',
    display: 'grid',
    gap: '10px',
  },
  titleRow: { marginTop: '2px' },
  metaRow: { marginTop: '0px' },
  rail: {
    display: 'flex',
    gap: '20px',
    padding: '0 var(--spacing-lg)',
    overflowX: 'hidden',
  },
  railItem: {
    flex: '0 0 auto',
    width: '200px',
  },
  heroBanner: {
    position: 'relative',
    height: '70vh',
    minHeight: '480px',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  },
  heroBannerContent: {
    position: 'absolute',
    bottom: '10%',
    left: 'var(--spacing-lg)',
    right: '40%',
  },
  heroBannerButtons: {
    display: 'flex',
    gap: '12px',
  },
  hero: {
    height: '80vh',
    minHeight: '500px',
    overflow: 'hidden',
  },
  detail: {
    padding: 'var(--spacing-xl) var(--spacing-lg)',
  },
  detailHero: {
    display: 'flex',
    gap: 'var(--spacing-xl)',
    flexWrap: 'wrap',
  },
  detailInfo: {
    flex: 1,
    minWidth: '240px',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  detailMeta: {
    marginTop: 'var(--spacing-sm)',
  },
};

export default Skeleton;
