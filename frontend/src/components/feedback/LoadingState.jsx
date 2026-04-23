function LoadingState({ message = 'Loading...', fullScreen = false }) {
  return (
    <div style={{
      ...styles.container,
      ...(fullScreen ? styles.fullScreen : {}),
    }}>
      <div style={styles.spinner}>
        <div style={styles.circle} />
        <div style={{ ...styles.circle, animationDelay: '0.2s' }} />
        <div style={{ ...styles.circle, animationDelay: '0.4s' }} />
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
  spinner: {
    display: 'flex',
    gap: '4px',
  },
  circle: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent-red)',
    animation: 'pulse 1s ease-in-out infinite',
  },
  message: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }
`;
document.head.appendChild(styleSheet);

export default LoadingState;