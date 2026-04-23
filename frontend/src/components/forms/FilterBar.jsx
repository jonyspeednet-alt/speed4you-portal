function FilterBar({ filters, activeFilters, onChange }) {
  return (
    <div style={styles.container}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          style={{
            ...styles.filter,
            ...(activeFilters.includes(filter.value) ? styles.filterActive : {}),
          }}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-md) 0',
  },
  filter: {
    padding: '8px 16px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: '0.85rem',
    fontWeight: '500',
    transition: 'all var(--transition-fast)',
  },
  filterActive: {
    background: 'var(--accent-red)',
    borderColor: 'var(--accent-red)',
    color: 'var(--text-primary)',
  },
};

export default FilterBar;