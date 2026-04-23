import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService } from '../services';
import { useBreakpoint } from '../hooks';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile } = useBreakpoint();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login(username, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      navigate(searchParams.get('next') || '/admin');
    } catch (loginError) {
      setError(loginError.message || 'Invalid credentials.');
    }

    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={{ ...styles.container, ...(isMobile ? styles.containerMobile : {}) }}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>ISP</span>
          <span style={styles.logoText}>ISP Portal</span>
        </div>

        <h1 style={styles.title}>Admin Login</h1>
        <p style={styles.subtitle}>Sign in to manage content</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              style={styles.input}
              placeholder="Enter username"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              placeholder="Enter password"
            />
          </div>

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <Link to="/" style={styles.backLink}>
          Back to Portal
        </Link>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #08111d 0%, #0f1c2e 56%, #08111d 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--spacing-xl)',
  },
  container: {
    width: '100%',
    maxWidth: '400px',
    padding: 'var(--spacing-xl)',
    background: 'rgba(13,26,43,0.84)',
    borderRadius: '28px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: 'var(--shadow-card)',
    backdropFilter: 'blur(18px)',
  },
  containerMobile: {
    maxWidth: '100%',
    padding: '18px',
    borderRadius: '24px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: 'var(--spacing-xl)',
  },
  logoIcon: {
    color: 'var(--accent-red)',
    fontSize: '0.8rem',
    letterSpacing: '0.12em',
    border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.3rem 0.45rem',
  },
  logoText: {
    color: 'var(--text-primary)',
  },
  title: {
    fontSize: '1.5rem',
    textAlign: 'center',
    marginBottom: 'var(--spacing-xs)',
  },
  subtitle: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    marginBottom: 'var(--spacing-xl)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  },
  error: {
    padding: 'var(--spacing-md)',
    background: 'rgba(229, 9, 20, 0.1)',
    border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent-red)',
    fontSize: '0.9rem',
  },
  field: {
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
  submitBtn: {
    padding: '14px 24px',
    background: 'linear-gradient(135deg, var(--accent-red), #ff8a54)',
    color: '#fff',
    borderRadius: '16px',
    fontWeight: '600',
    fontSize: '1rem',
    marginTop: 'var(--spacing-sm)',
  },
  backLink: {
    display: 'block',
    textAlign: 'center',
    marginTop: 'var(--spacing-lg)',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};

export default LoginPage;
