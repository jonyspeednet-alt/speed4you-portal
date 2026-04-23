import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function ErrorState({ 
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
}) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>
      
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.message}>{message}</p>
      
      <div style={styles.actions}>
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )}
        <Link to="/">
          <Button variant="secondary">
            Go to Homepage
          </Button>
        </Link>
      </div>
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
    minHeight: '400px',
  },
  icon: {
    color: 'var(--accent-red)',
    marginBottom: 'var(--spacing-lg)',
    opacity: 0.7,
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  },
  message: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    marginBottom: 'var(--spacing-lg)',
    maxWidth: '400px',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-md)',
  },
};

export default ErrorState;