function StarRating({ rating, maxRating = 10, showNumber = true, size = 'sm' }) {
  const numeric = parseFloat(rating);
  if (!numeric || isNaN(numeric)) return null;

  // Convert to 5-star scale
  const stars = (numeric / maxRating) * 5;
  const fullStars = Math.floor(stars);
  const hasHalf = stars - fullStars >= 0.4;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  const sz = size === 'sm' ? 12 : size === 'md' ? 14 : 16;

  return (
    <span style={styles.wrap} aria-label={`Rating: ${numeric} out of ${maxRating}`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <StarIcon key={`f${i}`} type="full" size={sz} />
      ))}
      {hasHalf && <StarIcon type="half" size={sz} />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <StarIcon key={`e${i}`} type="empty" size={sz} />
      ))}
      {showNumber && (
        <span style={{ ...styles.number, fontSize: sz * 0.9 + 'px' }}>{numeric}</span>
      )}
    </span>
  );
}

function StarIcon({ type, size }) {
  const color = type === 'empty' ? 'rgba(255,200,87,0.28)' : '#ffc857';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      {type === 'half' ? (
        <>
          <defs>
            <linearGradient id="half-grad">
              <stop offset="50%" stopColor="#ffc857" />
              <stop offset="50%" stopColor="rgba(255,200,87,0.28)" />
            </linearGradient>
          </defs>
          <path fill="url(#half-grad)" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </>
      ) : (
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      )}
    </svg>
  );
}

const styles = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
  },
  number: {
    color: 'var(--accent-amber)',
    fontWeight: '700',
    marginLeft: '4px',
    fontFamily: 'var(--font-family-ui)',
  },
};

export default StarRating;
