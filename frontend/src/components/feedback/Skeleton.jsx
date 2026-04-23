function Skeleton({ width, height, borderRadius = 'var(--radius-md)', style = {} }) {
  return (
    <div
      style={{
        width: width || '100%',
        height: height || '20px',
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export function PosterSkeleton() {
  return (
    <div style={styles.posterWrapper}>
      <Skeleton height="100%" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={styles.card}>
      <PosterSkeleton />
      <div style={styles.titleRow}>
        <Skeleton width="70%" height="16px" />
      </div>
      <div style={styles.metaRow}>
        <Skeleton width="40%" height="12px" />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div style={styles.hero}>
      <Skeleton height="100%" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div style={styles.detail}>
      <div style={styles.detailHero}>
        <Skeleton height="400px" borderRadius="var(--radius-lg)" />
        <div style={styles.detailInfo}>
          <Skeleton width="60%" height="40px" />
          <div style={styles.detailMeta}>
            <Skeleton width="100%" height="20px" />
          </div>
          <Skeleton width="80%" height="16px" />
          <Skeleton width="90%" height="60px" />
        </div>
      </div>
    </div>
  );
}

const styles = {
  posterWrapper: {
    aspectRatio: '2/3',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  card: {
    width: '100%',
  },
  titleRow: {
    marginTop: 'var(--spacing-sm)',
  },
  metaRow: {
    marginTop: 'var(--spacing-xs)',
  },
  hero: {
    height: '80vh',
    minHeight: '500px',
  },
  detail: {
    padding: 'var(--spacing-xl) var(--spacing-lg)',
  },
  detailHero: {
    display: 'flex',
    gap: 'var(--spacing-xl)',
  },
  detailInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  detailMeta: {
    marginTop: 'var(--spacing-sm)',
  },
};

export default Skeleton;