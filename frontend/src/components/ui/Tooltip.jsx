function Tooltip({ content, children, position = 'top' }) {
  const positions = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div style={styles.wrapper}>
      {children}
      <div style={{ ...styles.tooltip, ...positions[position] }}>
        {content}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  tooltip: {
    position: 'absolute',
    padding: '6px 12px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap',
    opacity: 0,
    visibility: 'hidden',
    transition: 'all 0.2s',
    zIndex: 1000,
  },
};

export default Tooltip;