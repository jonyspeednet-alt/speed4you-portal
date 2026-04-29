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
const { ensureContentStore, closePool } = require('./data/store');
const logger = require('./utils/logger');
const checkEnv = require('./config/env-check');

// Validate environment before doing anything else
checkEnv();

const app = express();
const PORT = process.env.PORT || 3001;
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = nodeEnv === 'production';
const corsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// The production deployment sits behind a single nginx hop. Limiting trust
// to one proxy avoids express-rate-limit permissive proxy warnings.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

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
      // In development, if no origins are specified, allow all.
      // In production, we'll have already thrown an error if REQUIRE_CORS_ALLOWLIST is 1.
      callback(null, true);
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
  contentSecurityPolicy: isProduction ? {
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
      styleSrc: ["'self'", 'https:'],
      workerSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", ...corsOrigins],
    },
  } : false,
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

// Group API routes to allow mounting at multiple points
const apiRouter = express.Router();
apiRouter.use('/auth', require('./routes/auth'));
apiRouter.use('/content', publicContentLimiter, require('./routes/content'));
apiRouter.use('/movies', publicContentLimiter, require('./routes/movies'));
apiRouter.use('/series', publicContentLimiter, require('./routes/series'));
apiRouter.use('/search', publicContentLimiter, require('./routes/search'));
apiRouter.use('/watchlist', require('./routes/watchlist'));
apiRouter.use('/progress', require('./routes/progress'));
apiRouter.use('/player', require('./routes/player'));
apiRouter.use('/tv', publicContentLimiter, require('./routes/tv'));
apiRouter.use('/admin', require('./routes/admin'));

// Mount at both /api (legacy/dev), / (proxied production), and /portal-api/api (Vite-configured prefix)
app.use('/api', apiRouter);
app.use('/portal-api/api', apiRouter);
app.use('/', apiRouter);

if (fs.existsSync(frontendDistPath)) {
  // Serve static assets from the frontend build
  // Support both the /portal prefix (configured in Vite) and the root
  app.use('/portal', express.static(frontendDistPath, {
    index: false,
    setHeaders: setStaticCacheHeaders,
  }));
  app.use(express.static(frontendDistPath, {
    index: false,
    setHeaders: setStaticCacheHeaders,
  }));

  // Handle SPA routing: serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/portal-api/')) {
      return next();
    }

    // Explicitly handle /health to avoid sending index.html
    if (req.path === '/health' || req.path === '/health/scanner') {
      return next();
    }

    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
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
    logger.error(`Unhandled error: ${err.message}`, { requestId: req.requestId, stack: err.stack });
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

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${nodeEnv}] (PID: ${process.pid})`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Failed to start server.`);
    } else {
      logger.error('Server error:', { error: error.message });
    }
    process.exit(1);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await closePool();
        logger.info('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', { error: err.message });
        process.exit(1);
      }
    });

    // If server doesn't close in 10s, force exit
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.error('Failed to initialize content store', { error: error.message, stack: error.stack });
  process.exit(1);
});

module.exports = app;
