import { useState } from 'react';
import { Link } from 'react-router-dom';

function ProfileMenu({ user }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return (
      <Link to="/login" style={styles.loginLink}>
        Sign In
      </Link>
    );
  }

  return (
    <div style={styles.container}>
      <button onClick={() => setIsOpen(!isOpen)} style={styles.avatar}>
        {user.username?.charAt(0).toUpperCase() || 'U'}
      </button>
      {isOpen && (
        <div style={styles.menu}>
          <div style={styles.header}>
            <span style={styles.headerLabel}>Profile</span>
            <strong style={styles.headerName}>{user.username}</strong>
          </div>
          <Link to="/watchlist" style={styles.item}>My List</Link>
          {user.role === 'admin' && <Link to="/admin" style={styles.item}>Admin</Link>}
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
            }}
            style={styles.item}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
  },
  avatar: {
    width: '42px',
    height: '42px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff9151)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    boxShadow: '0 10px 24px rgba(255,90,95,0.22)',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 10px)',
    minWidth: '188px',
    padding: '10px',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, rgba(13,26,43,0.98), rgba(7,17,31,0.98))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-card)',
    zIndex: 100,
  },
  header: {
    padding: '10px 12px 12px',
    marginBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerLabel: {
    display: 'block',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    fontWeight: '700',
    marginBottom: '6px',
  },
  headerName: {
    color: 'var(--text-primary)',
  },
  item: {
    display: 'block',
    width: '100%',
    padding: '11px 12px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    textAlign: 'left',
    borderRadius: '14px',
    fontWeight: '600',
  },
  loginLink: {
    padding: '11px 16px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)',
    fontWeight: '700',
  },
};

export default ProfileMenu;
