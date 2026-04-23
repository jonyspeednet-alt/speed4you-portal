import { useState } from 'react';

function SearchInput({ 
  value, 
  onChange, 
  placeholder = 'Search...',
  debounce = 300,
  onDebounce
}) {
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
    
    if (onDebounce) {
      clearTimeout(window.searchTimeout);
      window.searchTimeout = setTimeout(() => {
        onDebounce(newValue);
      }, debounce);
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div style={styles.container}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={styles.icon}>
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        style={styles.input}
      />
      {localValue && (
        <button onClick={handleClear} style={styles.clearBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    padding: '12px 40px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    outline: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: '8px',
    color: 'var(--text-muted)',
    padding: 'var(--spacing-xs)',
  },
};

export default SearchInput;