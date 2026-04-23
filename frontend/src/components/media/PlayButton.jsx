function PlayButton({ size = 'medium', onClick, style = {} }) {
  const sizes = {
    small: 40,
    medium: 56,
    large: 72,
  };

  const iconSizes = {
    small: 18,
    medium: 24,
    large: 32,
  };

  const s = sizes[size];
  const is = iconSizes[size];

  return (
    <button 
      onClick={onClick}
      style={{
        ...styles.button,
        width: s,
        height: s,
        ...style,
      }}
    >
      <svg width={is} height={is} viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
}

const styles = {
  button: {
    borderRadius: '50%',
    background: 'var(--accent-red)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.2s, background 0.2s',
  },
};

export default PlayButton;