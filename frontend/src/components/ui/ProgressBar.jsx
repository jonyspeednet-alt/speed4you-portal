function ProgressBar({ value = 0, max = 100, showLabel = false, size = 'medium', color = 'var(--accent-red)' }) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const heights = {
    small: '3px',
    medium: '5px',
    large: '8px',
  };

  return (
    <div style={styles.container}>
      <div style={{ ...styles.track, height: heights[size] }}>
        <div style={{ ...styles.fill, width: `${percent}%`, background: color }} />
      </div>
      {showLabel && <span style={styles.label}>{Math.round(percent)}%</span>}
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
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.3s ease',
  },
  label: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    minWidth: '35px',
    textAlign: 'right',
  },
};

export default ProgressBar;