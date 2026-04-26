import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function EmptyState({ 
  icon = 'default',
  title = 'Nothing here',
  message = 'No content available',
  actionLabel,
  actionHref,
  actionOnClick,
  secondaryActionLabel,
  secondaryActionHref,
  size = 'medium',
  animated = true,
}) {
  const icons = {
    default: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z" />
      </svg>
    ),
    search: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
    watchlist: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
      </svg>
    ),
    error: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
    movies: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
      </svg>
    ),
    series: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-3v4h-2v-4H7V9h3V5h2v4h3v2z" />
      </svg>
    ),
    network: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1 9l2-2v8a2 2 0 002 2h14a2 2 0 002-2V7l2 2V2h-2l-2 2v-.5A2.5 2.5 0 0014.5 1h-5A2.5 2.5 0 007 3.5V4L5 2H3v7zm2 3h2v2H3v-2zm14 0h2v2h-2v-2zm-7 0h2v2h-2v-2z" />
      </svg>
    ),
    content: (
      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  };

  return (
    <div style={{
      ...styles.container,
      ...(styles[size] || styles.medium),
      ...(animated ? styles.animated : {}),
    }}>
      <div style={{
        ...styles.icon,
        ...(animated ? styles.iconAnimated : {}),
      }}>
        {icons[icon] || icons.default}
      </div>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.message}>{message}</p>
      
      <div style={styles.actions}>
        {actionLabel && actionHref && (
          <Link to={actionHref}>
            <Button variant="primary">
              {actionLabel}
            </Button>
          </Link>
        )}
        {actionLabel && !actionHref && actionOnClick && (
          <Button variant="primary" onClick={actionOnClick}>
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && secondaryActionHref && (
          <Link to={secondaryActionHref}>
            <Button variant="outline" style={{ marginLeft: 'var(--spacing-md)' }}>
              {secondaryActionLabel}
            </Button>
          </Link>
        )}
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
    color: 'var(--text-muted)',
    minHeight: '300px',
  },
  small: {
    minHeight: '200px',
    padding: 'var(--spacing-xl)',
  },
  large: {
    minHeight: '400px',
    padding: 'var(--spacing-3xl)',
  },
  animated: {
    animation: 'fadeUp 0.4s ease',
  },
  icon: {
    marginBottom: 'var(--spacing-lg)',
    color: 'var(--text-muted)',
    opacity: 0.6,
  },
  iconAnimated: {
    animation: 'softFloat 3s ease-in-out infinite',
  },
  title: {
    fontSize: '1.5rem',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-sm)',
    fontWeight: '700',
    letterSpacing: '-0.02em',
  },
  message: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    maxWidth: '400px',
    lineHeight: '1.6',
    marginBottom: 'var(--spacing-lg)',
  },
  actions: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
};

export default EmptyState;