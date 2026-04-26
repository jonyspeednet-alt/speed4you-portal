require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { getScannerHealth } = require('./services/scanner');
const { compressionMiddleware, setStaticCacheHeaders } = require('./middleware/response-optimizer');
const { ensureContentStore } = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = nodeEnv === 'production';
const corsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// The production deployment sits behind nginx, so Express must trust the
// first proxy hop for client IP and rate limiting to work correctly.
app.set('trust proxy', true);

if ((isProduction || process.env.REQUIRE_CORS_ALLOWLIST === '1') && !corsOrigins.length) {
  throw new Error('CORS_ALLOWED_ORIGINS must be configured in production.');
}

function createCorsError() {
  const error = new Error('CORS origin is not allowed');
  error.status = 403;
  return error;
}

function buildCorsOriginChecker() {
  if (!corsOrigins.length) {
    return (origin, callback) => {
      callback(null, !origin);
    };
  }

  return (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(createCorsError());
  };
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      // Removed 'unsafe-inline' — use hashed styles or external stylesheets instead
      styleSrc: ["'self'", 'https:'],
      workerSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", ...corsOrigins],
    },
  },
  // Enforce HTTPS in production
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// Global rate limiter — broad protection against abuse on all API routes
const GLOBAL_API_LIMIT = Number(process.env.GLOBAL_API_RATE_LIMIT_MAX || 5000);
const PUBLIC_API_LIMIT = Number(process.env.PUBLIC_API_RATE_LIMIT_MAX || 20000);

function isReadOnlyPublicApiRequest(req) {
  if (!['GET', 'HEAD'].includes(String(req.method || '').toUpperCase())) {
    return false;
  }

  return [
    '/api/content',
    '/api/movies',
    '/api/series',
    '/api/search',
    '/api/tv',
  ].some((prefix) => req.path.startsWith(prefix));
}

const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: GLOBAL_API_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) =>
    !req.path.startsWith('/api/')
    || isReadOnlyPublicApiRequest(req)
    || req.ip === '127.0.0.1'
    || req.ip === '::1',
});

// Stricter limiter for public content endpoints (unauthenticated)
const publicContentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: PUBLIC_API_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1',
});

app.use(compressionMiddleware);
app.use(cors({
  origin: buildCorsOriginChecker(),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(globalApiLimiter);
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/scanner', (req, res) => {
  res.json(getScannerHealth());
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/content', publicContentLimiter, require('./routes/content'));
app.use('/api/movies', publicContentLimiter, require('./routes/movies'));
app.use('/api/series', publicContentLimiter, require('./routes/series'));
app.use('/api/search', publicContentLimiter, require('./routes/search'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/player', require('./routes/player'));
app.use('/api/tv', publicContentLimiter, require('./routes/tv'));
app.use('/api/admin', require('./routes/admin'));

if (fs.existsSync(frontendDistPath)) {
  app.use('/portal', express.static(frontendDistPath, {
    index: false,
    setHeaders: setStaticCacheHeaders,
  }));

  app.get('/portal', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  app.get('/portal/*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    return res.redirect('/portal');
  });
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'API route not found',
      },
      requestId: req.requestId || '',
    });
  }

  return next();
});

// Global error handler — never leak stack traces in production
app.use((err, req, res, next) => {
  const isPayloadTooLarge = err?.code === 'LIMIT_FILE_SIZE';
  const statusCode = Number(err.status || err.statusCode || (isPayloadTooLarge ? 413 : 500));

  // Always log the full error server-side
  if (statusCode >= 500) {
    console.error(`[${req.requestId}] Unhandled error:`, err);
  }

  const code = isPayloadTooLarge
    ? 'PAYLOAD_TOO_LARGE'
    : (err.code || (statusCode === 400 ? 'BAD_REQUEST' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'));
  const message = isPayloadTooLarge
    ? 'Uploaded file exceeds configured size limit'
    : (err.message || 'Internal Server Error');

  res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      details: Array.isArray(err.details) ? err.details : undefined,
      // Never expose stack traces in production
      ...(isProduction ? {} : { stack: err.stack }),
    },
    requestId: req.requestId || '',
  });
});

async function startServer() {
  await ensureContentStore();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${nodeEnv}]`);
  });
}

startServer().catch((error) => {
  console.error('Failed to initialize content store', error);
  process.exit(1);
});

module.exports = app;
