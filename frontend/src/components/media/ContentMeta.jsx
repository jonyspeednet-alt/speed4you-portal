function ContentMeta({ year, runtime, rating, genre, language }) {
  const items = [];
  if (year) items.push(year);
  if (runtime) items.push(runtime);
  if (rating) items.push(`★ ${rating}`);
  if (language) items.push(language);

  return (
    <div style={styles.container}>
      {items.map((item, i) => (
        <span key={i} style={styles.item}>{item}</span>
      ))}
      {genre && <span style={styles.genre}>{genre}</span>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    flexWrap: 'wrap',
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
  },
  item: {
    display: 'inline-flex',
  },
  genre: {
    color: 'var(--accent-amber)',
  },
};

export default ContentMeta;