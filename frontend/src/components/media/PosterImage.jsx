function PosterImage({ src, alt, size = 'medium', lazy = true }) {
  const sizes = {
    small: { width: 100, height: 150 },
    medium: { width: 180, height: 270 },
    large: { width: 240, height: 360 },
  };

  const dimensions = sizes[size] || sizes.medium;

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      style={{
        ...styles.image,
        width: dimensions.width,
        height: dimensions.height,
        objectFit: 'cover',
      }}
    />
  );
}

const styles = {
  image: {
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-tertiary)',
    transition: 'transform var(--transition-normal)',
  },
};

export default PosterImage;