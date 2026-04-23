function Input({ 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  label, 
  error,
  ...props 
}) {
  return (
    <div style={styles.container}>
      {label && <label style={styles.label}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
        }}
        {...props}
      />
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
  },
  label: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '12px 16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
  },
  inputError: {
    borderColor: 'var(--accent-red)',
  },
  error: {
    fontSize: '0.8rem',
    color: 'var(--accent-red)',
  },
};

export default Input;