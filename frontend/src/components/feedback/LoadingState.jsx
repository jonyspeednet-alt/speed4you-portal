function LoadingState({ message = 'Loading...', fullScreen = false }) {
  return (
    <div
      style={{
        ...styles.container,
        ...(fullScreen ? styles.fullScreen : {}),
      }}
      role="status"
      aria-label={message}
    >
      <div style={styles.ring} aria-hidden="true">
        <div style={styles.ringInner} />
      </div>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-md)',
    padding: 'var(--spacing-xl)',
  },
  fullScreen: {
    minHeight: '400px',
  },
  ring: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'conic-gradient(from 0deg, transparent 0%, var(--accent-red) 60%, transparent 100%)',
    animation: 'spin 0.8s linear infinite',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'var(--bg-primary)',
  },
  message: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: '500',
    letterSpacing: '0.01em',
  },
};

export default LoadingState;
