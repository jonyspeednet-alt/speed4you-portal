import { useState } from 'react';

function Tabs({ tabs, activeTab, onChange }) {
  const [hoveredTab, setHoveredTab] = useState(null);

  return (
    <div style={styles.container} role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isHovered = hoveredTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            onMouseEnter={() => setHoveredTab(tab.id)}
            onMouseLeave={() => setHoveredTab(null)}
            style={{
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
              ...(!isActive && isHovered ? styles.tabHover : {}),
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ ...styles.count, ...(isActive ? styles.countActive : {}) }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: '6px',
    padding: '4px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.07)',
    width: 'fit-content',
  },
  tab: {
    padding: '8px 18px',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    fontWeight: '600',
    borderRadius: '999px',
    transition: 'background 180ms ease, color 180ms ease, box-shadow 180ms ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
    cursor: 'pointer',
  },
  tabHover: {
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-secondary)',
  },
  tabActive: {
    background: 'linear-gradient(135deg, var(--accent-red), #ff7a45)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(255,90,95,0.35)',
  },
  count: {
    fontSize: '0.72rem',
    fontWeight: '700',
    background: 'rgba(255,255,255,0.12)',
    padding: '2px 7px',
    borderRadius: '999px',
    lineHeight: 1.4,
  },
  countActive: {
    background: 'rgba(255,255,255,0.22)',
  },
};

export default Tabs;
