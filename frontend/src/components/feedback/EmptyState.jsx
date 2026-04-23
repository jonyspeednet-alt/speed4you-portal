import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function EmptyState({ 
  icon = 'default',
  title = 'Nothing here',
  message = 'No content available',
  actionLabel,
  actionHref,
}) {
  const icons = {
    default: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3 }}>
        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z" />
      </svg>
    ),
    search: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3 }}>
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
    watchlist: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3 }}>
        <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
      </svg>
    ),
    error: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  };

  return (
    <div style={styles.container}>
      <div style={styles.icon}>{icons[icon]}</div>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.message}>{message}</p>
      {actionLabel && actionHref && (
        <Link to={actionHref}>
          <Button variant="primary" style={{ marginTop: 'var(--spacing-lg)' }}>
            {actionLabel}
          </Button>
        </Link>
      )}
      {actionLabel && !actionHref && (
        <Button variant="primary" style={{ marginTop: 'var(--spacing-lg)' }}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 'var(--spacing-2xl)',
    color: 'var(--text-muted)',
    minHeight: '300px',
  },
  icon: {
    marginBottom: 'var(--spacing-lg)',
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-sm)',
  },
  message: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    maxWidth: '400px',
  },
};

export default EmptyState;