function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel' }) {
  if (!isOpen) return null;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelBtn}>{cancelText}</button>
          <button onClick={onConfirm} style={styles.confirmBtn}>{confirmText}</button>
        </div>
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
    padding: 'var(--spacing-lg)', maxWidth: '400px', width: '90%',
  },
  title: { fontSize: '1.1rem', marginBottom: 'var(--spacing-sm)' },
  message: { color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' },
  actions: { display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' },
  cancelBtn: { padding: '8px 16px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer' },
  confirmBtn: { padding: '8px 16px', background: 'var(--accent-red)', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer' },
};

export default ConfirmDialog;