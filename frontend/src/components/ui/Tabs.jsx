function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div style={styles.container}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            ...styles.tab,
            ...(activeTab === tab.id ? styles.tabActive : {}),
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span style={styles.count}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 'var(--spacing-xs)',
  },
  tab: {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    fontWeight: '500',
    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
    transition: 'all var(--transition-fast)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  tabActive: {
    color: 'var(--text-primary)',
    background: 'var(--bg-secondary)',
  },
  count: {
    fontSize: '0.75rem',
    opacity: 0.7,
    background: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
  },
};

export default Tabs;