function Badge({ children, variant = 'default', size = 'medium' }) {
  const variants = {
    default: {
      background: 'var(--bg-tertiary)',
      color: 'var(--text-secondary)',
    },
    primary: {
      background: 'var(--accent-red)',
      color: 'var(--text-primary)',
    },
    success: {
      background: 'rgba(34, 197, 94, 0.2)',
      color: '#22c55e',
    },
    warning: {
      background: 'rgba(234, 179, 8, 0.2)',
      color: '#eab308',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444',
    },
  };

  const sizes = {
    small: {
      padding: '2px 6px',
      fontSize: '0.7rem',
    },
    medium: {
      padding: '4px 10px',
      fontSize: '0.8rem',
    },
    large: {
      padding: '6px 14px',
      fontSize: '0.9rem',
    },
  };

  return (
    <span style={{
      ...styles.badge,
      ...variants[variant],
      ...sizes[size],
    }}>
      {children}
    </span>
  );
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};

export default Badge;