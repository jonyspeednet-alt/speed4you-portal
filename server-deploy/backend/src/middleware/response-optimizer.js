const path = require('path');
const zlib = require('zlib');

const TEXT_LIKE_TYPES = [
  'application/javascript',
  'application/json',
  'application/manifest+json',
  'application/xml',
  'image/svg+xml',
  'text/',
];

function appendVaryHeader(currentValue, nextValue) {
  const existing = String(currentValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!existing.includes(nextValue)) {
    existing.push(nextValue);
  }

  return existing.join(', ');
}

function shouldCompress(contentType) {
  return TEXT_LIKE_TYPES.some((candidate) => contentType.includes(candidate));
}

function compressionMiddleware(req, res, next) {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const accepted = String(req.headers['accept-encoding'] || '');
  const encoding = accepted.includes('br') ? 'br' : accepted.includes('gzip') ? 'gzip' : '';

  if (!encoding) {
    next();
    return;
  }

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const originalOn = res.on.bind(res);
  let compressor;
  let responseFinished = false;
  let streamDestroyed = false;

  function finishWithOriginalEnd(chunk, encodingArg, callback) {
    if (responseFinished) {
      return res;
    }

    responseFinished = true;
    return originalEnd(chunk, encodingArg, callback);
  }

  function getCompressor() {
    if (compressor !== undefined) {
      return compressor;
    }

    const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
    const cacheControl = String(res.getHeader('Cache-Control') || '').toLowerCase();
    const hasExistingEncoding = Boolean(res.getHeader('Content-Encoding'));
    const hasRange = Boolean(res.getHeader('Content-Range'));

    if (
      !contentType
      || !shouldCompress(contentType)
      || hasExistingEncoding
      || hasRange
      || cacheControl.includes('no-transform')
    ) {
      compressor = null;
      return compressor;
    }

    res.setHeader('Vary', appendVaryHeader(res.getHeader('Vary'), 'Accept-Encoding'));
    res.setHeader('Content-Encoding', encoding);
    res.removeHeader('Content-Length');

    compressor = encoding === 'br'
      ? zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      })
      : zlib.createGzip({ level: 6 });

    compressor.on('data', (chunk) => {
      originalWrite(chunk);
    });

    compressor.on('error', () => {
      if (streamDestroyed || responseFinished) {
        return;
      }

      streamDestroyed = true;
      res.removeHeader('Content-Encoding');
      finishWithOriginalEnd();
    });

    compressor.on('end', () => {
      finishWithOriginalEnd();
    });

    return compressor;
  }

  originalOn('close', () => {
    if (compressor && !streamDestroyed) {
      streamDestroyed = true;
      compressor.destroy();
    }
  });

  res.write = (chunk, encodingArg, callback) => {
    const stream = getCompressor();
    if (!stream) {
      return originalWrite(chunk, encodingArg, callback);
    }

    return stream.write(chunk, encodingArg, callback);
  };

  res.end = (chunk, encodingArg, callback) => {
    const stream = getCompressor();
    if (!stream) {
      return finishWithOriginalEnd(chunk, encodingArg, callback);
    }

    if (chunk) {
      stream.write(chunk, encodingArg);
    }

    stream.end();
    if (typeof callback === 'function') {
      callback();
    }

    return res;
  };

  next();
}

function setStaticCacheHeaders(res, filePath) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  const isHtml = normalizedPath.endsWith('/index.html') || path.basename(normalizedPath) === 'index.html';
  const isHashedAsset = /\/assets\/.+-[A-Za-z0-9_-]{8,}\./.test(normalizedPath);
  const basename = path.basename(normalizedPath);

  if (basename === 'sw.js' || basename === 'manifest.json') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return;
  }

  if (isHtml) {
    res.setHeader('Cache-Control', 'no-cache');
    return;
  }

  if (isHashedAsset) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
}

function setApiCacheHeaders(res, endpoint) {
  if (endpoint.includes('/auth/')) {
    res.setHeader('Cache-Control', 'private, no-store');
  } else if (endpoint.includes('/content/homepage') || endpoint.includes('/content/featured')) {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  } else if (endpoint.includes('/content')) {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=10');
  }
}

module.exports = {
  compressionMiddleware,
  setStaticCacheHeaders,
  setApiCacheHeaders,
};
