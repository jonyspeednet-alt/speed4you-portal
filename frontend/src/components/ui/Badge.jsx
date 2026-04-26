function Badge({ children, variant = 'default', size = 'medium' }) {
  const variants = {
    default: {
      background: 'rgba(255,255,255,0.07)',
      color: 'var(--text-secondary)',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    primary: {
      background: 'linear-gradient(135deg, var(--accent-red), #ff7a45)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 10px rgba(255,90,95,0.35)',
    },
    success: {
      background: 'rgba(34,197,94,0.14)',
      color: '#4ade80',
      border: '1px solid rgba(34,197,94,0.28)',
    },
    warning: {
      background: 'rgba(255,200,87,0.14)',
      color: 'var(--accent-amber)',
      border: '1px solid rgba(255,200,87,0.28)',
    },
    danger: {
      background: 'rgba(239,68,68,0.14)',
      color: '#f87171',
      border: '1px solid rgba(239,68,68,0.28)',
    },
    live: {
      background: 'rgba(239,68,68,0.18)',
      color: '#f87171',
      border: '1px solid rgba(239,68,68,0.38)',
      animation: 'livePulse 1.6s ease-in-out infinite',
    },
    new: {
      background: 'linear-gradient(135deg, rgba(255,90,95,0.22), rgba(255,122,69,0.22))',
      color: '#ff8a6a',
      border: '1px solid rgba(255,90,95,0.32)',
    },
    hd: {
      background: 'rgba(125,249,255,0.12)',
      color: 'var(--accent-cyan)',
      border: '1px solid rgba(125,249,255,0.28)',
    },
    quality: {
      background: 'rgba(167,139,250,0.14)',
      color: 'var(--accent-purple)',
      border: '1px solid rgba(167,139,250,0.28)',
    },
  };

  const sizes = {
    small: { padding: '2px 8px', fontSize: '0.65rem' },
    medium: { padding: '4px 10px', fontSize: '0.75rem' },
    large: { padding: '6px 14px', fontSize: '0.85rem' },
  };

  return (
    <span
      style={{
        ...styles.badge,
        ...variants[variant] || variants.default,
        ...sizes[size] || sizes.medium,
      }}
    >
      {variant === 'live' && <span style={styles.liveDot} aria-hidden="true" />}
      {children}
    </span>
  );
}

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    borderRadius: '999px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#f87171',
    flexShrink: 0,
    animation: 'livePulse 1.2s ease-in-out infinite',
  },
};

export default Badge;
