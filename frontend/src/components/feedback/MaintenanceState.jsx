function MaintenanceState({ 
  title = 'Under Maintenance', 
  message = 'We will be back soon',
  estimatedTime 
}) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
        </svg>
      </div>
      <h1 style={styles.title}>{title}</h1>
      <p style={styles.message}>{message}</p>
      {estimatedTime && <p style={styles.time}>ETA: {estimatedTime}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 'var(--spacing-xl)',
    background: 'var(--bg-primary)',
    textAlign: 'center',
  },
  icon: {
    color: 'var(--accent-amber)',
    marginBottom: 'var(--spacing-xl)',
  },
  title: {
    fontSize: '2rem',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  },
  message: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
  },
  time: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginTop: 'var(--spacing-sm)',
  },
};

export default MaintenanceState;