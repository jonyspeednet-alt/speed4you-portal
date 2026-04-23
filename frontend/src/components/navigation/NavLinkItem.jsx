import { Link } from 'react-router-dom';

function NavLinkItem({ to, label, icon, active = false, onClick }) {
  return (
    <Link 
      to={to} 
      onClick={onClick}
      style={{
        ...styles.link,
        ...(active ? styles.active : {}),
      }}
    >
      {icon && <span style={styles.icon}>{icon}</span>}
      <span>{label}</span>
    </Link>
  );
}

const styles = {
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all var(--transition-fast)',
  },
  active: {
    color: 'var(--text-primary)',
    background: 'var(--bg-tertiary)',
  },
  icon: {
    fontSize: '1rem',
  },
};

export default NavLinkItem;
