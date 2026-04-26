function ProgressBar({ value = 0, max = 100, showLabel = false, size = 'medium' }) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  const heights = {
    small: '3px',
    medium: '5px',
    large: '8px',
  };

  const h = heights[size] || heights.medium;

  return (
    <div style={styles.container}>
      <div
        style={{ ...styles.track, height: h }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            ...styles.fill,
            width: `${percent}%`,
            height: h,
            boxShadow: percent > 0
              ? '0 0 8px rgba(255,90,95,0.55), 0 0 16px rgba(255,200,87,0.3)'
              : 'none',
          }}
        />
      </div>
      {showLabel && (
        <span style={styles.label}>{Math.round(percent)}%</span>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
  },
  track: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: '999px',
    background: 'linear-gradient(90deg, var(--accent-red), var(--accent-amber))',
    transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
  },
  label: {
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    minWidth: '36px',
    textAlign: 'right',
    letterSpacing: '0.02em',
  },
};

export default ProgressBar;
