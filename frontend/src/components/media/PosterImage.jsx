import { useState } from 'react';

const FALLBACK_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"%3E%3Crect width="2" height="3" fill="%2314243a"/%3E%3C/svg%3E';

function PosterImage({ src, alt, size = 'medium', lazy = true, onLoad, className }) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const sizes = {
    small: { width: 100, height: 150 },
    medium: { width: 180, height: 270 },
    large: { width: 240, height: 360 },
  };

  const dimensions = sizes[size] || sizes.medium;
  const activeSrc = errored ? FALLBACK_SRC : (src || FALLBACK_SRC);

  return (
    <div
      style={{
        ...styles.wrapper,
        width: dimensions.width,
        height: dimensions.height,
      }}
      className={className}
    >
      {/* Shimmer placeholder shown until image loads */}
      {!loaded && (
        <div style={styles.placeholder} aria-hidden="true">
          <div style={styles.shimmer} />
        </div>
      )}
      <img
        src={activeSrc}
        alt={alt || ''}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        fetchPriority={lazy ? 'low' : 'high'}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          ...styles.image,
          opacity: loaded ? 1 : 0,
        }}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: 'var(--bg-tertiary)',
    flexShrink: 0,
  },
  placeholder: {
    position: 'absolute',
    inset: 0,
    background: 'var(--bg-tertiary)',
  },
  shimmer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity var(--transition-normal)',
  },
};

export default PosterImage;