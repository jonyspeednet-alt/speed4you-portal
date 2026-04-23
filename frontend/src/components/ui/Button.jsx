const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false,
  onClick,
  type = 'button',
  style = {},
  ...props 
}) => {
  const variants = {
    primary: {
      background: 'var(--accent-red)',
      color: 'var(--text-primary)',
      border: 'none',
    },
    secondary: {
      background: 'rgba(109, 109, 110, 0.7)',
      color: 'var(--text-primary)',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: 'none',
    },
  };

  const sizes = {
    small: {
      padding: '8px 16px',
      fontSize: '0.85rem',
    },
    medium: {
      padding: '12px 24px',
      fontSize: '1rem',
    },
    large: {
      padding: '16px 32px',
      fontSize: '1.1rem',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.base,
        ...variants[variant],
        ...sizes[size],
        ...(disabled ? styles.disabled : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};

const styles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    outline: 'none',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default Button;