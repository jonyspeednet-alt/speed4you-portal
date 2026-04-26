import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  errorType = 'general',
}) {
  const getErrorIcon = () => {
    switch (errorType) {
      case 'network':
        return (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 9l2-2v8a2 2 0 002 2h14a2 2 0 002-2V7l2 2V2h-2l-2 2v-.5A2.5 2.5 0 0014.5 1h-5A2.5 2.5 0 007 3.5V4L5 2H3v7zm2 3h2v2H3v-2zm14 0h2v2h-2v-2zm-7 0h2v2h-2v-2z" />
          </svg>
        );
      case 'content':
        return (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        );
      default:
        return (
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        );
    }
  };

  const getHelpfulActions = () => {
    switch (errorType) {
      case 'network':
        return [
          { label: 'Check Connection', action: () => window.location.reload() },
          { label: 'Try Again', action: onRetry },
        ];
      case 'content':
        return [
          { label: 'Browse Catalog', to: '/browse' },
          { label: 'Go Home', to: '/' },
        ];
      default:
        return [
          { label: 'Try Again', action: onRetry },
          { label: 'Go Home', to: '/' },
        ];
    }
  };

  const actions = getHelpfulActions();

  return (
    <div style={styles.container}>
      <div style={styles.iconWrapper}>
        <div style={styles.icon}>
          {getErrorIcon()}
        </div>
        <div style={styles.iconGlow} />
      </div>

      <div style={styles.content}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>

        {errorType === 'network' && (
          <div style={styles.helpText}>
            <strong>Troubleshooting tips:</strong>
            <ul style={styles.helpList}>
              <li style={styles.helpListItem}>Check your internet connection</li>
              <li style={styles.helpListItem}>Try refreshing the page</li>
              <li style={styles.helpListItem}>Clear your browser cache if the problem persists</li>
            </ul>
          </div>
        )}

        <div style={styles.actions}>
          {actions.map((action, index) => (
            action.to ? (
              <Link key={index} to={action.to}>
                <Button variant={index === 0 ? "primary" : "secondary"}>
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                key={index}
                variant={index === 0 ? "primary" : "secondary"}
                onClick={action.action}
                disabled={!action.action}
              >
                {action.label}
              </Button>
            )
          ))}
        </div>
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
    animation: 'fadeUp 0.4s ease',
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 'var(--spacing-xl)',
  },
  icon: {
    width: '64px',
    height: '64px',
    color: 'var(--accent-red)',
    opacity: 0.8,
    position: 'relative',
    zIndex: 1,
  },
  iconGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    background: 'radial-gradient(circle, rgba(255,90,95,0.2) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'pulseGlow 3s ease-in-out infinite',
  },
  content: {
    maxWidth: '480px',
    width: '100%',
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  message: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-lg)',
    lineHeight: '1.6',
  },
  helpText: {
    textAlign: 'left',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-lg)',
    fontSize: '0.88rem',
    color: 'var(--text-secondary)',
  },
  helpList: {
    margin: 'var(--spacing-sm) 0 0 0',
    paddingLeft: 'var(--spacing-lg)',
    color: 'var(--text-muted)',
  },
  helpListItem: {
    marginBottom: '4px',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
};

export default ErrorState;