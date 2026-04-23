function BannerImage({ src, alt, size = 'large', lazy = true }) {
  const sizes = {
    small: { width: 320, height: 180 },
    medium: { width: 640, height: 360 },
    large: { width: 1280, height: 720 },
    hero: { width: 1920, height: 800 },
  };

  const dimensions = sizes[size] || sizes.large;

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
  },
};

export default BannerImage;