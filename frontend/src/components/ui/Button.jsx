import { useState, useRef } from 'react';

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  iconLeft = null,
  iconRight = null,
  onClick,
  type = 'button',
  style = {},
  ...props
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const buttonRef = useRef(null);
  const isDisabled = disabled || loading;

  const createRipple = (event) => {
    if (isDisabled) return;
    
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple = {
      id: Date.now(),
      x,
      y,
      size,
    };

    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  const variantStyles = {
    primary: {
      background: hovered
        ? 'linear-gradient(135deg, #ff3f47, #ff8a54)'
        : 'linear-gradient(135deg, var(--accent-red), #ff7a45)',
      color: '#fff',
      border: 'none',
      boxShadow: hovered
        ? '0 8px 28px var(--glow-red), 0 2px 8px rgba(0,0,0,0.3)'
        : '0 4px 16px rgba(255,90,95,0.28)',
    },
    secondary: {
      background: hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)',
      color: 'var(--text-primary)',
      border: '1px solid rgba(255,255,255,0.14)',
      backdropFilter: 'blur(12px)',
      boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.2)' : 'none',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-strong)',
      boxShadow: hovered ? '0 0 0 1px rgba(255,255,255,0.18)' : 'none',
    },
    ghost: {
      background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
      color: 'var(--text-secondary)',
      border: 'none',
    },
    danger: {
      background: hovered
        ? 'linear-gradient(135deg, #dc2626, #ef4444)'
        : 'linear-gradient(135deg, #b91c1c, #dc2626)',
      color: '#fff',
      border: 'none',
      boxShadow: hovered
        ? '0 8px 24px rgba(239,68,68,0.4)'
        : '0 4px 12px rgba(239,68,68,0.2)',
    },
  };

  const sizeStyles = {
    small: { padding: '8px 16px', fontSize: '0.82rem', gap: '6px' },
    medium: { padding: '12px 24px', fontSize: '0.95rem', gap: '8px' },
    large: { padding: '15px 32px', fontSize: '1.05rem', gap: '10px' },
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseDownCapture={createRipple}
      style={{
        ...styles.base,
        ...variantStyles[variant] || variantStyles.primary,
        ...sizeStyles[size] || sizeStyles.medium,
        ...(isDisabled ? styles.disabled : {}),
        transform: hovered && !isDisabled && !pressed 
          ? 'translateY(-2px) scale(1.02)' 
          : pressed && !isDisabled 
            ? 'translateY(0) scale(0.98)' 
            : 'translateY(0) scale(1)',
        ...style,
      }}
      {...props}
    >
      {/* Ripple effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          style={{
            ...styles.ripple,
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}

      {loading ? (
        <span style={styles.spinner} aria-hidden="true" />
      ) : iconLeft ? (
        <span style={styles.icon}>{iconLeft}</span>
      ) : null}

      <span style={styles.content}>{children}</span>

      {!loading && iconRight && (
        <span style={styles.icon}>{iconRight}</span>
      )}
    </button>
  );
};

const styles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'background 200ms ease, box-shadow 200ms ease, transform 180ms ease, border-color 200ms ease',
    outline: 'none',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  disabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.25)',
    borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  ripple: {
    position: 'absolute',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.3)',
    transform: 'scale(0)',
    animation: 'rippleEffect 0.6s linear',
    pointerEvents: 'none',
  },
};

export default Button;
