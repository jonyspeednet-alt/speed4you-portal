function InfoModal({ isOpen, onClose, title, content }) {
  if (!isOpen) return null;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3>{title}</h3>
          <button onClick={onClose} style={styles.close}>×</button>
        </div>
        <div style={styles.body}>{content}</div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
    maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)',
  },
  close: { fontSize: '1.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' },
  body: { padding: 'var(--spacing-md)' },
};

export default InfoModal;