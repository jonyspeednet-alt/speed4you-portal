import { Link } from 'react-router-dom';

function SearchTrigger({ onClick }) {
  return (
    <button onClick={onClick} style={styles.trigger}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <span style={styles.text}>Search</span>
    </button>
  );
}

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: '8px 16px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  text: {
    fontSize: '0.9rem',
  },
};

export default SearchTrigger;